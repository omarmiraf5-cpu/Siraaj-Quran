import { createAdminClient, passwordUser } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendNewSchoolAlert } from "@/lib/newSchoolAlert";
import { sendSchoolWelcome } from "@/lib/schoolWelcome";
import { sendAccountWelcomes, type NewAccount } from "@/lib/accountWelcome";
import { studentLoginEmail, studentLoginPassword } from "@/lib/studentAuth";
import { isTimeZone } from "@/lib/places";
import { after, NextRequest, NextResponse } from "next/server";
import { PROVISIONED } from "@/lib/accountProvisioning";

// Bootstraps a brand-new school: no admin session exists yet to gate this
// behind (unlike /api/admin/accounts, which requires one), so this is the
// one place in the app that creates a school and its first admin together,
// entirely through the service-role client.

interface OnboardingData {
  // country: ISO 3166 code. province: a Canadian province's code, or
  // elsewhere whatever state or region was typed, possibly blank.
  // organisedByGrade: an academic school, its students in grades (K to 12)
  // with halaqas inside each grade; campuses: its sites, when it has more
  // than one. Its students come in afterwards, from a spreadsheet.
  school: {
    name: string;
    city: string;
    country?: string;
    province?: string;
    timezone: string;
    organisedByGrade?: boolean;
    campuses?: string[];
  };
  admin: { fullName: string; email: string; password: string };
  teachers: Array<{ name: string; email: string; halaqa: string }>;
  students: Array<{ name: string; age: number; halaqa: string }>;
  // Children are named by their position in `students` above, not by name:
  // the students don't have database ids yet while the form is open, and
  // matching on name afterwards breaks on the two Muhammads every roster
  // has. Positions are unambiguous and survive identical names.
  parents?: Array<{ name: string; email: string; studentIndexes: number[] }>;
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

// The school code students type or open a link with. Accents are folded
// away first ("École" becomes "ecole", not "cole"), and a name with no
// Latin letters at all, say one written in Arabic, falls back to "school"
// (made unique below) rather than an empty code.
function slugify(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "school"
  );
}

function initials(fullName: string) {
  return fullName.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function randomPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Whether whoever is signing up is MyDiiwaan's own owner, signed in. */
async function isPlatformOwner(): Promise<boolean> {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (!user) return false;
    const { data } = await session.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle();
    return data?.is_platform_admin === true;
  } catch {
    return false;
  }
}

/**
 * Whether whoever is signing up is the person behind this existing login:
 * signed in to it in this browser, or holding its password.
 */
async function isTheirs(userId: string, email: string, password: string): Promise<boolean> {
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (user?.id === userId) return true;
  } catch {
    // Not signed in: the password has to show it.
  }
  return (await passwordUser(email, password)) === userId;
}

export async function POST(request: NextRequest) {
  const admin = createAdminClient();

  // Tracked so a failure partway through can be unwound below — otherwise a
  // school that fails on, say, its third teacher is left half-created, and
  // simply retrying the same submission hits "already registered" on the
  // admin account instead of a clean second attempt.
  let schoolId: string | undefined;
  const createdUserIds: string[] = [];
  // A login that already existed and was made this school's admin: put back
  // as it was if the school can't be finished, never deleted.
  let adopted: { id: string; role: string; full_name: string } | null = null;

  try {
    const data: OnboardingData = await request.json();

    if (!data.school?.name || !data.admin?.email) {
      return NextResponse.json({ error: "School name, admin email, and password are required" }, { status: 400 });
    }
    // Any country's zone, but a real one: every date a school sees (today's
    // attendance, due dates, the calendar) is worked out in it.
    if (!isTimeZone(data.school.timezone)) {
      return NextResponse.json({ error: "Choose your school's time zone." }, { status: 400 });
    }
    // An academic school (kept in grades, with campuses) is set up by the
    // platform's owner alone; everyone else signs up a Qur'an school.
    if (data.school.organisedByGrade === true && !(await isPlatformOwner())) {
      return NextResponse.json(
        { error: "An academic school is set up by MyDiiwaan itself. Please contact us." },
        { status: 403 }
      );
    }
    // Missing only from a sign-up form loaded before countries were offered,
    // which listed Canadian provinces and zones alone.
    const country = /^[A-Z]{2}$/.test(data.school.country ?? "") ? (data.school.country as string) : "CA";

    // Checked up front, before anything is created: a collision discovered
    // partway through (e.g. on the third teacher) would already have left a
    // real school and admin account behind, and simply fixing that one
    // email and resubmitting would re-hit the same failure on the admin
    // account this time, since it was already created by the first attempt.
    const teacherList = data.teachers ?? [];
    const studentList = data.students ?? [];
    const parentList = data.parents ?? [];

    // The admin may teach as well: listed as a teacher under their own
    // email, they teach that halaqa with the admin's login rather than a
    // second one, since an email can only have one. Every other address
    // still needs to be someone else's.
    const adminEmail = data.admin.email.trim().toLowerCase();
    const isAdmin = (teacher: { email: string }) => teacher.email.trim().toLowerCase() === adminEmail;
    const adminHalaqas = Array.from(new Set(teacherList.filter(isAdmin).map((t) => t.halaqa).filter(Boolean)));
    const emails = [
      adminEmail,
      ...teacherList.filter((t) => !isAdmin(t)).map((t) => t.email.trim().toLowerCase()),
      ...parentList.map((p) => p.email.trim().toLowerCase()),
    ];
    const duplicateWithinSubmission = emails.find((e, i) => emails.indexOf(e) !== i);
    if (duplicateWithinSubmission) {
      return NextResponse.json(
        { error: `"${duplicateWithinSubmission}" is used more than once — each admin, teacher, and parent needs a different email.` },
        { status: 400 }
      );
    }

    // Checked before anything is created, for the same reason the email
    // collision above is: a parent pointing at a student who isn't in the
    // submission would otherwise surface only after the whole school had
    // been built and then torn back down again.
    for (const parent of parentList) {
      const bad = (parent.studentIndexes ?? []).find(
        (i) => !Number.isInteger(i) || i < 0 || i >= studentList.length
      );
      if (bad !== undefined) {
        return NextResponse.json(
          { error: `Parent "${parent.name}" is linked to a student who isn't on the list — remove and re-add them.` },
          { status: 400 }
        );
      }
    }
    const { data: alreadyRegistered } = await admin
      .from("profiles")
      .select("id, email, role, full_name, school_id")
      .in("email", emails);
    // The admin's email may already be a login that belongs to no school —
    // the platform owner's, made outside this sign-up — and that login
    // becomes the school's admin, once whoever is signing up shows it's
    // theirs. A login that is already some school's stays where it is.
    const existingAdmin = (alreadyRegistered ?? []).find(
      (p) => (p.email ?? "").toLowerCase() === adminEmail && !p.school_id
    );
    if (existingAdmin && !(await isTheirs(existingAdmin.id, adminEmail, data.admin.password ?? ""))) {
      return NextResponse.json(
        {
          error: `${adminEmail} already has a MyDiiwaan login. To make it this school's admin, sign in to it first, or enter its password on the Admin step.`,
        },
        { status: 400 }
      );
    }
    const taken = (alreadyRegistered ?? []).filter((p) => p !== existingAdmin);
    if (taken.length > 0) {
      return NextResponse.json(
        { error: `Already registered: ${taken.map((p) => p.email).join(", ")}. Use different email addresses and try again.` },
        { status: 400 }
      );
    }
    if (!existingAdmin && !data.admin.password) {
      return NextResponse.json({ error: "School name, admin email, and password are required" }, { status: 400 });
    }

    const baseSlug = slugify(data.school.name);
    let slug = baseSlug;
    for (let i = 1; i <= 50; i++) {
      const { data: existing } = await admin.from("schools").select("id").eq("slug", slug).maybeSingle();
      if (!existing) break;
      slug = `${baseSlug}-${i}`;
    }

    const academic = data.school.organisedByGrade === true;
    // Each campus once, as it was first written, whatever its capitals.
    const campusNames = academic
      ? (data.school.campuses ?? [])
          .map((c) => String(c).trim().slice(0, 60))
          .filter((c, i, all) => c && all.findIndex((x) => x.toLowerCase() === c.toLowerCase()) === i)
          .slice(0, 10)
      : [];
    const schoolRow = {
      name: data.school.name.trim(),
      slug,
      city: (data.school.city ?? "").trim(),
      province: (data.school.province ?? "").trim(),
      timezone: data.school.timezone,
      // Only an academic school needs the grades update to have been run.
      ...(academic ? { organised_by_grade: true } : {}),
    };
    let { data: school, error: schoolError } = await admin
      .from("schools")
      .insert({ ...schoolRow, country })
      .select()
      .single();
    // A database that hasn't had schema.sql re-run since schools.country was
    // added has nowhere to keep it: the school is created without it rather
    // than not at all.
    if (schoolError && /country/.test(schoolError.message) && ["PGRST204", "42703"].includes(schoolError.code)) {
      ({ data: school, error: schoolError } = await admin.from("schools").insert(schoolRow).select().single());
    }
    if (schoolError && academic && /organised_by_grade/.test(schoolError.message)) {
      throw new Error("Academic schools need the grades update run in Supabase first (mydiiwaan-update-7.sql).");
    }
    if (schoolError) throw new Error(`School creation failed: ${schoolError.message}`);

    schoolId = school.id as string;

    if (campusNames.length > 0) {
      const { error: campusError } = await admin
        .from("campuses")
        .insert(campusNames.map((name) => ({ school_id: schoolId, name })));
      if (campusError) throw new Error(`Campuses failed: ${campusError.message}`);
    }

    let adminId: string;
    if (existingAdmin) {
      // Their own login, made this school's admin. Its password stays the
      // one they have.
      adopted = { id: existingAdmin.id, role: existingAdmin.role, full_name: existingAdmin.full_name };
      const { error: adoptError } = await admin
        .from("profiles")
        .update({ role: "admin", school_id: schoolId, full_name: data.admin.fullName.trim() || existingAdmin.full_name })
        .eq("id", existingAdmin.id);
      if (adoptError) throw new Error(`Admin account failed: ${adoptError.message}`);
      adminId = existingAdmin.id;
    } else {
      // handle_new_user() (schema.sql) auto-inserts the matching profiles row
      // from this metadata the moment the auth user exists, so admin/teacher
      // profiles are never inserted by hand here.
      const { data: adminAuth, error: adminError } = await admin.auth.admin.createUser({
        email: adminEmail,
        password: data.admin.password,
        email_confirm: true,
        app_metadata: PROVISIONED,
        user_metadata: { role: "admin", full_name: data.admin.fullName.trim(), school_id: schoolId },
      });
      if (adminError) throw new Error(`Admin account failed: ${adminError.message}`);
      createdUserIds.push(adminAuth.user.id);
      adminId = adminAuth.user.id;
    }

    // Each teacher's temporary password goes back to the caller with them.
    // It used to be generated here and discarded, which left every teacher a
    // school added during signup holding an account nobody — not even the
    // admin who just created it — knew the password to.
    // Every teacher given for each halaqa: the first becomes its teacher
    // (classes.teacher_id), any others teach it alongside them.
    const teacherIdsByHalaqa: Record<string, string[]> = {};
    const teacherLogins: Array<{ name: string; email: string; password: string }> = [];
    // Each teacher and parent is also emailed a link to choose their own
    // password, once the school is complete; the temporary one above stays
    // the way in if the email doesn't arrive.
    const welcomes: NewAccount[] = [];
    for (const teacher of teacherList) {
      // The admin, teaching with their own login.
      if (isAdmin(teacher)) {
        if (teacher.halaqa && !teacherIdsByHalaqa[teacher.halaqa]?.includes(adminId)) {
          (teacherIdsByHalaqa[teacher.halaqa] ??= []).push(adminId);
        }
        continue;
      }
      const email = teacher.email.trim().toLowerCase();
      const password = `Temp${randomPin()}${randomPin()}!`;
      const { data: teacherAuth, error: teacherError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: PROVISIONED,
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
      if (teacher.halaqa) (teacherIdsByHalaqa[teacher.halaqa] ??= []).push(teacherAuth.user.id);
      teacherLogins.push({ name: teacher.name.trim(), email, password });
      welcomes.push({ userId: teacherAuth.user.id, name: teacher.name.trim(), email, role: "teacher" });
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
          teacher_id: teacherIdsByHalaqa[halaqa]?.[0] ?? null,
          school_id: schoolId,
        })
        .select()
        .single();
      if (classError) throw new Error(`Halaqa "${halaqa}" failed: ${classError.message}`);
      classIdByHalaqa[halaqa] = cls.id;
      const others = (teacherIdsByHalaqa[halaqa] ?? []).slice(1);
      if (others.length > 0) {
        const { error: coError } = await admin
          .from("class_teachers")
          .insert(others.map((teacher_id) => ({ class_id: cls.id, teacher_id })));
        // A database that hasn't had class_teachers added yet (schema.sql):
        // the halaqa keeps its first teacher rather than the signup failing.
        if (coError && ["42P01", "PGRST205"].includes(coError.code)) {
          console.warn(`Onboarding: "${halaqa}" keeps one teacher; class_teachers isn't set up yet.`);
        } else if (coError) {
          throw new Error(`Teachers for "${halaqa}" failed: ${coError.message}`);
        }
      }
    }

    const studentPins: Array<{ name: string; halaqa: string; pin: string }> = [];
    // Parallel to studentList, so a parent's studentIndexes resolve straight
    // into real row ids once every student exists.
    const studentRowIds: string[] = [];
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
        app_metadata: PROVISIONED,
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
      studentRowIds.push(studentRow.id as string);
    }

    // Parents come last, once every student has a real id to be linked to.
    // The link rows go in through the service-role client rather than the
    // caller's session the way /api/admin/accounts does it — during signup
    // there is no session at all, the admin account was created seconds ago
    // and nobody has signed into it yet.
    const parentLogins: Array<{
      name: string;
      email: string;
      password: string;
      children: string[];
    }> = [];
    for (const parent of parentList) {
      const email = parent.email.trim().toLowerCase();
      const password = `Temp${randomPin()}${randomPin()}!`;
      const { data: parentAuth, error: parentError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: PROVISIONED,
        user_metadata: {
          role: "parent",
          full_name: parent.name.trim(),
          school_id: schoolId,
          must_change_password: true,
        },
      });
      if (parentError) throw new Error(`Parent "${parent.name}" failed: ${parentError.message}`);
      createdUserIds.push(parentAuth.user.id);

      // Deduped because (parent_id, student_id) is the table's primary key —
      // the same child ticked twice would abort the whole insert.
      const childIndexes = Array.from(new Set(parent.studentIndexes ?? []));
      if (childIndexes.length > 0) {
        const { error: linkError } = await admin.from("parent_students").insert(
          childIndexes.map((i) => ({
            parent_id: parentAuth.user.id,
            student_id: studentRowIds[i],
          }))
        );
        if (linkError) {
          throw new Error(`Linking children to "${parent.name}" failed: ${linkError.message}`);
        }
      }

      parentLogins.push({
        name: parent.name.trim(),
        email,
        password,
        children: childIndexes.map((i) => studentList[i].name.trim()),
      });
      welcomes.push({
        userId: parentAuth.user.id,
        name: parent.name.trim(),
        email,
        role: "parent",
        children: childIndexes.map((i) => studentList[i].name.trim()),
      });
    }

    // The school is complete. Its emails go out after this response does, so
    // the new admin never waits on them: their welcome, the owner's heads-up,
    // and each teacher's and parent's welcome with a link to choose their
    // password. Every sender only logs a failed send, so none can reach the
    // unwind below.
    const counts = {
      halaqas: halaqaNames.length,
      teachers: teacherLogins.length + (adminHalaqas.length > 0 ? 1 : 0),
      students: studentPins.length,
      parents: parentLogins.length,
    };
    after(() =>
      sendSchoolWelcome({
        name: school.name,
        slug,
        adminName: data.admin.fullName,
        adminEmail,
        ...counts,
        adultsEmailed: welcomes.length > 0,
      })
    );
    after(() =>
      sendNewSchoolAlert({
        name: school.name,
        city: school.city,
        province: school.province,
        country,
        adminName: data.admin.fullName,
        adminEmail,
        ...counts,
      })
    );
    if (welcomes.length > 0) {
      after(() => sendAccountWelcomes(welcomes, { name: school.name, replyTo: adminEmail }));
    }

    return NextResponse.json(
      {
        success: true,
        schoolId,
        slug,
        adminEmail: data.admin.email,
        // Their own login, made this school's: signed into with the password
        // it already had.
        existingAccount: !!existingAdmin,
        // The halaqas the admin teaches, with that same login.
        adminTeaches: adminHalaqas,
        teachers: teacherLogins,
        students: studentPins,
        parents: parentLogins,
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
      // A login that was already someone's goes back as it was, before the
      // school does: deleting the school deletes its people's profiles too.
      if (adopted) {
        await admin
          .from("profiles")
          .update({ role: adopted.role, school_id: null, full_name: adopted.full_name })
          .eq("id", adopted.id);
      }
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
