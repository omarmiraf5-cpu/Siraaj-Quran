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
 */
export async function deleteSchoolAndAccounts(admin: Db, schoolId: string): Promise<SchoolDeletion> {
  const { data: school } = await admin.from("schools").select("id, name").eq("id", schoolId).single();
  if (!school) return { ok: false, status: 404, error: "School not found" };

  // Every login this school's people have — admins, teachers, parents, and
  // any student with a real PIN account — captured before the school row
  // (and its cascade) removes the profiles pointing to them. auth.users
  // isn't reachable from a cascade off `schools`, so those accounts would
  // otherwise survive as orphans with the email permanently "taken".
  const { data: peopleProfiles, error: profilesError } = await admin
    .from("profiles")
    .select("id")
    .eq("school_id", schoolId);
  if (profilesError) return { ok: false, status: 500, error: profilesError.message };

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
