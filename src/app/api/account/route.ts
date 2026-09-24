import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, isError, notify, schoolAdmins } from "@/lib/attendanceServer";
import { deleteSchoolAndAccounts } from "@/lib/accountDeletion";

/**
 * Your own account: what it is, and deleting it — which the app stores
 * require be possible from inside the app.
 *
 * - A parent or teacher deletes their login and profile. What they recorded
 *   about students (attendance, lessons, plans, messages) stays with the
 *   school without their name; see the migration at the end of schema.sql.
 * - An admin can do the same while the school has another admin. The only
 *   admin can't leave a school with nobody to run it, so for them deleting
 *   the account means deleting the school and everything in it, confirmed
 *   by typing the school's name.
 * - A student's account is the school's (they are children, signed in with
 *   a PIN the school issued), so a student asks the office to delete it.
 *
 * The school office is told either way.
 */

async function context() {
  const supabase = await createClient();
  const member = await requireMember(supabase);
  if (isError(member)) return member;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { data: school } = await admin.from("schools").select("name").eq("id", member.school_id).single();
  const otherAdmins = (await schoolAdmins(admin, member.school_id)).filter((a) => a.id !== member.id);
  return { member, email: user?.email ?? null, admin, schoolName: (school?.name as string) ?? "your school", otherAdmins };
}

export async function GET() {
  const ctx = await context();
  if (isError(ctx)) return ctx.error;
  const { member, email, schoolName, otherAdmins } = ctx;
  return NextResponse.json({
    full_name: member.full_name,
    role: member.role,
    // A student's sign-in address is generated from their record, not theirs.
    email: member.role === "student" ? null : email,
    school_name: schoolName,
    sole_admin: member.role === "admin" && otherAdmins.length === 0,
  });
}

export async function DELETE(req: NextRequest) {
  const ctx = await context();
  if (isError(ctx)) return ctx.error;
  const { member, admin, schoolName, otherAdmins } = ctx;
  const body = (await req.json().catch(() => ({}))) as { confirm?: string; deleteSchool?: boolean };
  const confirm = (body.confirm ?? "").trim().toLowerCase();

  if (member.role === "student") {
    const offices = await schoolAdmins(admin, member.school_id);
    await notify(
      admin,
      offices.map((o) => ({
        school_id: member.school_id,
        recipient_id: o.id,
        kind: "deletion_request" as const,
        title: `${member.full_name} asked for their account to be deleted`,
        body: "They asked from their Account page. To delete it, open Students, tap their name and choose Delete permanently — check with their parent first if you need to.",
        dedupe_key: `deletion-request:${member.id}`,
      }))
    );
    return NextResponse.json({ requested: true });
  }

  if (member.role === "admin" && otherAdmins.length === 0) {
    if (!body.deleteSchool) {
      return NextResponse.json(
        { error: `You're the only admin of ${schoolName}.`, sole_admin: true },
        { status: 409 }
      );
    }
    if (confirm !== schoolName.trim().toLowerCase()) {
      return NextResponse.json({ error: `Type the school's name, ${schoolName}, to confirm.` }, { status: 400 });
    }
    const result = await deleteSchoolAndAccounts(admin, member.school_id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ deleted: true, deleted_school: result.deleted });
  }

  if (confirm !== "delete") {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(member.id);
  if (error) {
    console.error("Account deletion failed", error);
    return NextResponse.json({ error: "Your account couldn't be deleted. Please try again." }, { status: 500 });
  }

  const role = member.role === "admin" ? "an admin" : `a ${member.role}`;
  await notify(
    admin,
    otherAdmins.map((o) => ({
      school_id: member.school_id,
      recipient_id: o.id,
      kind: "account_deleted" as const,
      title: `${member.full_name} deleted their account`,
      body: `${member.full_name}, ${role} at ${schoolName}, deleted their MyDiiwaan account. Their login is gone; the lessons, attendance and messages they recorded stay with the school.`,
      dedupe_key: `account-deleted:${member.id}`,
    }))
  );
  return NextResponse.json({ deleted: true });
}
