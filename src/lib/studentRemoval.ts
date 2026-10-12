import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** How long a student stays inactive before the office is offered to remove their records. */
export const INACTIVE_YEARS = 2;

/**
 * Removes a student for good: their PIN login, then their record and
 * everything recorded about them (every table keyed to a student cascades).
 * The login first: if the record went first, nothing would point at the
 * login any more and it would be left behind.
 */
export async function removeStudent(admin: Admin, student: { id: string; profile_id: string | null }): Promise<string | null> {
  if (student.profile_id) {
    const { error } = await admin.auth.admin.deleteUser(student.profile_id);
    if (error && !/not found/i.test(error.message)) return "The student's sign-in couldn't be removed. Try again.";
  }
  const { error } = await admin.from("students").delete().eq("id", student.id);
  return error ? error.message : null;
}
