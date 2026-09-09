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
  students: Array<{ name: string; grade: number; halaqa: string }>;
}

const AVATAR_COLORS = ["bg-subject-blue", "bg-subject-teal", "bg-subject-purple", "bg-subject-orange", "bg-subject-pink"];

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
    const emails = [
      data.admin.email.trim().toLowerCase(),
      ...data.teachers.map((t) => t.email.trim().toLowerCase()),
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

    const schoolId = school.id as string;

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

    const teacherIdByHalaqa: Record<string, string> = {};
    for (const teacher of data.teachers) {
      const { data: teacherAuth, error: teacherError } = await admin.auth.admin.createUser({
        email: teacher.email.trim().toLowerCase(),
        password: `Temp${randomPin()}${randomPin()}!`,
        email_confirm: true,
        user_metadata: { role: "teacher", full_name: teacher.name.trim(), school_id: schoolId },
      });
      if (teacherError) throw new Error(`Teacher "${teacher.name}" failed: ${teacherError.message}`);
      teacherIdByHalaqa[teacher.halaqa] = teacherAuth.user.id;
    }

    const halaqaNames = Array.from(
      new Set([...data.teachers.map((t) => t.halaqa), ...data.students.map((s) => s.halaqa)].filter(Boolean))
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
    for (const student of data.students) {
      const { data: studentRow, error: studentError } = await admin
        .from("students")
        .insert({
          full_name: student.name.trim(),
          grade: student.grade,
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

      await admin.from("students").update({ pin, profile_id: studentAuth.user.id }).eq("id", studentRow.id);

      const classId = classIdByHalaqa[student.halaqa];
      if (classId) {
        await admin.from("class_enrollments").insert({ class_id: classId, student_id: studentRow.id });
      }

      studentPins.push({ name: student.name, halaqa: student.halaqa, pin });
    }

    return NextResponse.json(
      {
        success: true,
        schoolId,
        slug,
        adminEmail: data.admin.email,
        students: studentPins,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Onboarding error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Onboarding failed" },
      { status: 400 }
    );
  }
}
