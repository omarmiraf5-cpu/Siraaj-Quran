import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

// A teacher at more than one school: one login, its profile in one school
// at a time (the one it's switched into), and school_memberships listing
// every school it teaches at, the current one included (schema.sql,
// "Teachers at more than one school"). A teacher at one school has no
// memberships at all — just their profile, as always.
//
// Everything here runs as the service role, after the caller has been
// checked: the office for adding, switching off and removing a school, the
// teacher themselves for switching.

type Db = ReturnType<typeof createAdminClient>;

export interface Membership {
  school_id: string;
  active: boolean;
}

/** Every school this login teaches at; none for a teacher at one school. */
export async function membershipsOf(admin: Db, userId: string): Promise<Membership[]> {
  const { data, error } = await admin.from("school_memberships").select("school_id, active").eq("user_id", userId);
  // Before the update that adds memberships, there are none.
  if (error) return [];
  return (data ?? []) as Membership[];
}

/** This school's own say on a teacher who teaches elsewhere too; null if they don't, or don't teach here. */
export async function membershipAt(admin: Db, userId: string, schoolId: string): Promise<Membership | null> {
  const { data, error } = await admin
    .from("school_memberships")
    .select("school_id, active")
    .eq("user_id", userId)
    .eq("school_id", schoolId)
    .maybeSingle();
  if (error || !data) return null;
  return data as Membership;
}

/** Into one of its schools: the profile there, as a teacher, switched on or off as that school has it. */
export async function moveTo(admin: Db, userId: string, schoolId: string, active = true): Promise<void> {
  const { error } = await admin.from("profiles").update({ school_id: schoolId, role: "teacher", active }).eq("id", userId);
  if (error) throw error;
}

/**
 * Adds a school to a teacher's login. The school they're in now is kept as
 * one of theirs; a login switched off everywhere comes into the new one,
 * since that school wants them. Says if they already teach here.
 */
export async function addSchool(
  admin: Db,
  teacher: { id: string; school_id: string; active: boolean | null },
  schoolId: string
): Promise<{ added: true; movedIn: boolean } | { added: false; reason: "already" | "switched_off_here" }> {
  const here = await membershipAt(admin, teacher.id, schoolId);
  if (here) return { added: false, reason: here.active ? "already" : "switched_off_here" };

  const { error: keepError } = await admin
    .from("school_memberships")
    .upsert({ user_id: teacher.id, school_id: teacher.school_id, role: "teacher", active: teacher.active !== false }, {
      onConflict: "user_id,school_id",
      ignoreDuplicates: true,
    });
  if (keepError) throw keepError;
  const { error: addError } = await admin
    .from("school_memberships")
    .insert({ user_id: teacher.id, school_id: schoolId, role: "teacher", active: true });
  if (addError) throw addError;

  if (teacher.active === false) {
    await moveTo(admin, teacher.id, schoolId, true);
    return { added: true, movedIn: true };
  }
  return { added: true, movedIn: false };
}

/**
 * Switched off or back on at one school, for a teacher who teaches at
 * others too; null for anyone else (the caller does what it always did).
 * Off at the school they're in moves them to another of theirs that has
 * them on; only when none does is the login itself locked out.
 */
export async function setActiveAt(
  admin: Db,
  userId: string,
  schoolId: string,
  active: boolean
): Promise<{ lockedOut: boolean; unlocked: boolean } | null> {
  const memberships = await membershipsOf(admin, userId);
  if (memberships.length < 2 || !memberships.some((m) => m.school_id === schoolId)) return null;

  const { error } = await admin
    .from("school_memberships")
    .update({ active })
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  if (error) throw error;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("school_id, active")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;

  if (active) {
    // Locked out everywhere until now: in here, and able to sign in again.
    if (profile.active === false) {
      await moveTo(admin, userId, schoolId, true);
      return { lockedOut: false, unlocked: true };
    }
    return { lockedOut: false, unlocked: false };
  }
  if (profile.school_id !== schoolId) return { lockedOut: false, unlocked: false };
  const elsewhere = memberships.find((m) => m.school_id !== schoolId && m.active);
  if (elsewhere) {
    await moveTo(admin, userId, elsewhere.school_id, true);
    return { lockedOut: false, unlocked: false };
  }
  const { error: offError } = await admin.from("profiles").update({ active: false }).eq("id", userId);
  if (offError) throw offError;
  return { lockedOut: true, unlocked: false };
}

/**
 * Takes one school off a teacher who teaches at others too: its halaqas
 * there wait for another teacher, and their login moves to another of
 * their schools if it was in this one. Null for anyone else (the caller
 * deletes the login, as always).
 */
export async function removeSchool(
  admin: Db,
  userId: string,
  schoolId: string
): Promise<{ stillAt: string; lockedOut: boolean } | null> {
  const memberships = await membershipsOf(admin, userId);
  if (memberships.length < 2 || !memberships.some((m) => m.school_id === schoolId)) return null;

  const { data: classes, error: classesError } = await admin.from("classes").select("id, teacher_id").eq("school_id", schoolId);
  if (classesError) throw classesError;
  const classIds = (classes ?? []).map((c: { id: string }) => c.id);
  if (classIds.length > 0) {
    const { error: leadError } = await admin.from("classes").update({ teacher_id: null }).in("id", classIds).eq("teacher_id", userId);
    if (leadError) throw leadError;
    const { error: othersError } = await admin.from("class_teachers").delete().eq("teacher_id", userId).in("class_id", classIds);
    if (othersError) throw othersError;
  }
  const { error: removeError } = await admin
    .from("school_memberships")
    .delete()
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  if (removeError) throw removeError;

  const remaining = memberships.filter((m) => m.school_id !== schoolId);
  const { data: profile, error: profileError } = await admin.from("profiles").select("school_id").eq("id", userId).single();
  if (profileError) throw profileError;
  let stillAt = profile.school_id as string;
  let lockedOut = false;
  if (profile.school_id === schoolId) {
    // To one that has them on; if every other school has them off, the login is off too.
    const next = remaining.find((m) => m.active) ?? remaining[0];
    await moveTo(admin, userId, next.school_id, next.active);
    stillAt = next.school_id;
    lockedOut = !next.active;
  }
  // Down to one school: just their profile there again.
  if (remaining.length === 1) {
    const { error: lastError } = await admin.from("school_memberships").delete().eq("user_id", userId);
    if (lastError) throw lastError;
  }
  return { stillAt, lockedOut };
}

/** The ids of a school's teachers at other schools too, with whether this school has them on. */
export async function schoolMembers(admin: Db, schoolId: string): Promise<Map<string, boolean>> {
  const { data, error } = await admin.from("school_memberships").select("user_id, active").eq("school_id", schoolId);
  if (error) return new Map();
  return new Map((data ?? []).map((m: { user_id: string; active: boolean }) => [m.user_id, m.active]));
}

/** Whether someone teaches at a school: a teacher's login there now, or one of their schools. */
export async function teachesAtSchool(admin: Db, userId: string, schoolId: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("school_id, role").eq("id", userId).maybeSingle();
  if (data && data.school_id === schoolId && data.role === "teacher") return true;
  return (await membershipAt(admin, userId, schoolId)) !== null;
}

/**
 * A school's teachers, those switched into another of their schools
 * included, each switched on or off as this school has them.
 */
export async function schoolTeacherProfiles(
  admin: Db,
  schoolId: string
): Promise<Array<{ id: string; full_name: string; email: string | null; active: boolean | null }>> {
  const members = await schoolMembers(admin, schoolId);
  const [{ data: here }, { data: away }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, active").eq("school_id", schoolId).eq("role", "teacher"),
    members.size > 0
      ? admin.from("profiles").select("id, full_name, email, active").in("id", [...members.keys()])
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string; email: string | null; active: boolean | null }> }),
  ]);
  const byId = new Map<string, { id: string; full_name: string; email: string | null; active: boolean | null }>();
  for (const p of [...(here ?? []), ...(away ?? [])] as Array<{ id: string; full_name: string; email: string | null; active: boolean | null }>) {
    byId.set(p.id, { ...p, active: members.has(p.id) ? (members.get(p.id) as boolean) : p.active });
  }
  return [...byId.values()].sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
}

/**
 * Before a school is deleted: its people who teach at other schools too go
 * to one of those, rather than losing their login. Returns their ids.
 */
export async function rehomeBeforeSchoolGoes(admin: Db, schoolId: string, peopleIds: string[]): Promise<string[]> {
  const kept: string[] = [];
  for (const id of peopleIds) {
    const others = (await membershipsOf(admin, id)).filter((m) => m.school_id !== schoolId);
    if (others.length === 0) continue;
    const next = others.find((m) => m.active) ?? others[0];
    await moveTo(admin, id, next.school_id, next.active);
    if (others.length === 1) await admin.from("school_memberships").delete().eq("user_id", id);
    kept.push(id);
  }
  return kept;
}
