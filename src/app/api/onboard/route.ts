import { createAdminClient } from "@/lib/supabase/admin";
import { studentLoginEmail, studentLoginPassword } from "@/lib/studentAuth";
import { NextRequest, NextResponse } from "next/server";

// Bootstraps a brand-new school: no admin session exists yet to gate this
// behind (unlike /api/admin/accounts, which requires one), so this is the
// one place in the app that creates a school and its first admin together,
// entirely through the service-role client.

interface OnboardingData {
  school: { name: string; city: string; province: string; timezone: string };
  admin: { fullName: string; email: string; password: string };
  teachers: Array<{ name: string; email: string; halaqa: string }>;
  students: Array<{ name: string; age: number; halaqa: string }>;
}

const AVATAR_COLORS = ["bg-subject-blue", "bg-subject-teal", "bg-subject-purple", "bg-subject-orange", "bg-subject-pink"];

// The students table still tracks school grade (not collected during
// onboarding anymore) and has no separate "age" column, so an age is
// converted both ways: a rough grade for the existing not-null column,
// and an approximate date of birth — Jan 1 of the birth year, since an
// age alone doesn't give an exact day — for anything that later wants
// a real date rather than a school-year guess.
function gradeFromAge(age: number): number {
  return Math.min(10, Math.max(0, Math.round(age) - 6));
}
function approximateDateOfBirth(age: number): string {
  const birthYear = new Date().getUTCFullYear() - Math.round(age);
  return `${birthYear}-01-01`;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function initials(fullName: string) {
  return fullName.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient();

  // Tracked so a failure partway through can be unwound below — otherwise a
  // school that fails on, say, its third teacher is left half-created, and
  // simply retrying the same submission hits "already registered" on the
  // admin account instead of a clean second attempt.
  let schoolId: string | undefined;
  const createdUserIds: string[] = [];

  try {
    const data: OnboardingData = await request.json();

    if (!data.school?.name || !data.admin?.email || !data.admin?.password) {
      return NextResponse.json({ error: "School name, admin email, and password are required" }, { status: 400 });
    }

    // Checked up front, before anything is created: a collision discovered
    // partway through (e.g. on the third teacher) would already have left a
    // real school and admin account behind, and simply fixing that one
    // email and resubmitting would re-hit the same failure on the admin
    // account this time, since it was already created by the first attempt.
    const teacherList = data.teachers ?? [];
    const studentList = data.students ?? [];

    const emails = [
      data.admin.email.trim().toLowerCase(),
      ...teacherList.map((t) => t.email.trim().toLowerCase()),
    ];
    const duplicateWithinSubmission = emails.find((e, i) => emails.indexOf(e) !== i);
    if (duplicateWithinSubmission) {
      return NextResponse.json(
        { error: `"${duplicateWithinSubmission}" is used more than once — each admin and teacher needs a different email.` },
        { status: 400 }
      );
    }
    const { data: alreadyRegistered } = await admin.from("profiles").select("email").in("email", emails);
    if (alreadyRegistered && alreadyRegistered.length > 0) {
      const taken = alreadyRegistered.map((p) => p.email).join(", ");
      return NextResponse.json(
        { error: `Already registered: ${taken}. Use different email addresses and try again.` },
        { status: 400 }
      );
    }

    const baseSlug = slugify(data.school.name);
    let slug = baseSlug;
    for (let i = 1; i <= 50; i++) {
      const { data: existing } = await admin.from("schools").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i}`;
    }

    const { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({
        name: data.school.name.trim(),
        slug,
        city: data.school.city.trim() || "Edmonton",
        province: data.school.province || "AB",
        timezone: data.school.timezone || "America/Edmonton",
      })
      .select()
      .single();
    if (schoolError) throw new Error(`School creation failed: ${schoolError.message}`);

    schoolId = school.id as string;

    // handle_new_user() (schema.sql) auto-inserts the matching profiles row
    // from this metadata the moment the auth user exists, so admin/teacher
    // profiles are never inserted by hand here.
    const { data: adminAuth, error: adminError } = await admin.auth.admin.createUser({
      email: data.admin.email.trim().toLowerCase(),
      password: data.admin.password,
      email_confirm: true,
      user_metadata: { role: "admin", full_name: data.admin.fullName.trim(), school_id: schoolId },
    });
    if (adminError) throw new Error(`Admin account failed: ${adminError.message}`);
    createdUserIds.push(adminAuth.user.id);

    // Each teacher's temporary password goes back to the caller with them.
    // It used to be generated here and discarded, which left every teacher a
    // school added during signup holding an account nobody — not even the
    // admin who just created it — knew the password to.
    const teacherIdByHalaqa: Record<string, string> = {};
    const teacherLogins: Array<{ name: string; email: string; password: string }> = [];
    for (const teacher of teacherList) {
      const email = teacher.email.trim().toLowerCase();
      const password = `Temp${randomPin()}${randomPin()}!`;
      const { data: teacherAuth, error: teacherError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          role: "teacher",
          full_name: teacher.name.trim(),
          school_id: schoolId,
          // Read by /change-password and the login redirect — this
          // password is the one printed on the onboarding completion
          // screen, not one the teacher chose themselves.
          must_change_password: true,
        },
      });
      if (teacherError) throw new Error(`Teacher "${teacher.name}" failed: ${teacherError.message}`);
      createdUserIds.push(teacherAuth.user.id);
      teacherIdByHalaqa[teacher.halaqa] = teacherAuth.user.id;
      teacherLogins.push({ name: teacher.name.trim(), email, password });
    }

    const halaqaNames = Array.from(
      new Set([...teacherList.map((t) => t.halaqa), ...studentList.map((s) => s.halaqa)].filter(Boolean))
    );
    const classIdByHalaqa: Record<string, string> = {};
    for (const halaqa of halaqaNames) {
      const { data: cls, error: classError } = await admin
        .from("classes")
        .insert({
          name: halaqa,
          subject: "Qur'an & Hifz",
          grade: 0,
          teacher_id: teacherIdByHalaqa[halaqa] ?? null,
          school_id: schoolId,
        })
        .select()
        .single();
      if (classError) throw new Error(`Halaqa "${halaqa}" failed: ${classError.message}`);
      classIdByHalaqa[halaqa] = cls.id;
    }

    const studentPins: Array<{ name: string; halaqa: string; pin: string }> = [];
    for (const student of studentList) {
      const { data: studentRow, error: studentError } = await admin
        .from("students")
        .insert({
          full_name: student.name.trim(),
          grade: gradeFromAge(student.age),
          date_of_birth: approximateDateOfBirth(student.age),
          avatar_initials: initials(student.name),
          avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          school_id: schoolId,
        })
        .select()
        .single();
      if (studentError) throw new Error(`Student "${student.name}" failed: ${studentError.message}`);

      const pin = randomPin();
      const { data: studentAuth, error: studentAuthError } = await admin.auth.admin.createUser({
        email: studentLoginEmail(studentRow.id),
        password: studentLoginPassword(studentRow.id, pin),
        email_confirm: true,
        user_metadata: { role: "student", full_name: student.name.trim(), school_id: schoolId },
      });
      if (studentAuthError) throw new Error(`Student login for "${student.name}" failed: ${studentAuthError.message}`);
      createdUserIds.push(studentAuth.user.id);

      const { error: linkError } = await admin
        .from("students")
        .update({ pin, profile_id: studentAuth.user.id })
        .eq("id", studentRow.id);
      if (linkError) throw new Error(`Linking login for "${student.name}" failed: ${linkError.message}`);

      const classId = classIdByHalaqa[student.halaqa];
      if (classId) {
        const { error: enrollError } = await admin
          .from("class_enrollments")
          .insert({ class_id: classId, student_id: studentRow.id });
        if (enrollError) throw new Error(`Enrolling "${student.name}" in "${student.halaqa}" failed: ${enrollError.message}`);
      }

      studentPins.push({ name: student.name, halaqa: student.halaqa, pin });
    }

    return NextResponse.json(
      {
        success: true,
        schoolId,
        slug,
        adminEmail: data.admin.email,
        teachers: teacherLogins,
        students: studentPins,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Onboarding error:", error);

    // Best-effort unwind so the admin can just fix the one bad field and
    // resubmit, instead of getting stuck on "already registered" for an
    // account this same failed attempt created. Deleting the school first
    // cascades away its profiles/classes/students rows; auth users aren't
    // tied to the school row, so they're removed separately.
    try {
      if (schoolId) {
        await admin.from("schools").delete().eq("id", schoolId);
      }
      for (const userId of createdUserIds) {
        await admin.auth.admin.deleteUser(userId);
      }
    } catch (cleanupError) {
      console.error("Onboarding cleanup after a failed attempt also failed:", cleanupError);
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Onboarding failed" },
      { status: 400 }
    );
  }
}
