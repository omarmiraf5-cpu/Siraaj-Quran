import "server-only";

import type { Db } from "@/lib/attendanceServer";

export type SchoolDeletion =
  | { ok: true; deleted: string; accountsRemoved: number; accountErrors: string[] }
  | { ok: false; status: number; error: string };

/**
 * Deletes a school, everything recorded under it, and every login its
 * people have. Used by the platform operator's school list and by a
 * school's only admin deleting their own account from inside the app.
 *
 * `schools` has no RLS delete policy for anyone, so this goes through the
 * service role; callers check who may do it.
 *
 * With keepPlatformOwners, an operator of the platform who is one of the
 * school's people (its admin, say) keeps their login, without the school:
 * deleting a school from the platform's list doesn't delete the operator.
 */
export async function deleteSchoolAndAccounts(
  admin: Db,
  schoolId: string,
  { keepPlatformOwners = false }: { keepPlatformOwners?: boolean } = {}
): Promise<SchoolDeletion> {
  const { data: school } = await admin.from("schools").select("id, name").eq("id", schoolId).single();
  if (!school) return { ok: false, status: 404, error: "School not found" };

  // Every login this school's people have — admins, teachers, parents, and
  // any student with a real PIN account — captured before the school row
  // (and its cascade) removes the profiles pointing to them. auth.users
  // isn't reachable from a cascade off `schools`, so those accounts would
  // otherwise survive as orphans with the email permanently "taken".
  const { data: everyone, error: profilesError } = await admin
    .from("profiles")
    .select("id, is_platform_admin")
    .eq("school_id", schoolId);
  if (profilesError) return { ok: false, status: 500, error: profilesError.message };
  const people = (everyone ?? []) as Array<{ id: string; is_platform_admin: boolean | null }>;
  const kept = keepPlatformOwners ? people.filter((p) => p.is_platform_admin).map((p) => p.id) : [];
  const peopleProfiles = people.filter((p) => !kept.includes(p.id));

  // Taken out of the school first: deleting it deletes its people's
  // profiles too. Back to how a login with no school stands.
  if (kept.length > 0) {
    const { error: detachError } = await admin
      .from("profiles")
      .update({ school_id: null, role: "parent" })
      .in("id", kept);
    if (detachError) return { ok: false, status: 500, error: detachError.message };
  }

  const { error: deleteError } = await admin.from("schools").delete().eq("id", schoolId);
  if (deleteError) return { ok: false, status: 500, error: deleteError.message };

  const accountErrors: string[] = [];
  for (const { id } of (peopleProfiles ?? []) as Array<{ id: string }>) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) accountErrors.push(error.message);
  }

  return {
    ok: true,
    deleted: school.name as string,
    accountsRemoved: (peopleProfiles?.length ?? 0) - accountErrors.length,
    accountErrors,
  };
}
