import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "crypto";
import { createProvisionedUser } from "@/lib/accountProvisioning";
import { sendAccountWelcomes, type NewAccount } from "@/lib/accountWelcome";
import { requireAdmin } from "@/lib/adminAccounts";
import { studentLoginEmail, studentLoginPassword } from "@/lib/studentAuth";
import { gradeLabel, isGrade } from "@/lib/grades";

// A school's roster from a spreadsheet, a batch of rows at a time (Admin →
// Students → Import): each child made a student with a sign-in PIN, put in
// their halaqa — made on the way if the school doesn't have it yet, in its
// campus and grade — and their parent given a login, or linked to the one
// they already have. Batches keep each request short however big the school
// is; a row that can't be done is said why and the rest carry on, and a row
// already done is skipped, so the same sheet can safely be imported again.

export const maxDuration = 60;

const MAX_ROWS = 25;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLORS = ["bg-subject-blue", "bg-subject-teal", "bg-subject-purple", "bg-subject-orange", "bg-subject-pink"];

export interface ImportRow {
  name: string;
  grade: number | null;
  campus: string;
  halaqa: string;
  parentName: string;
  parentEmail: string;
}

export interface RowResult {
  status: "added" | "skipped" | "failed";
  name: string;
  /** Where they were put: "North · Grade 3 · Halaqa A". */
  place?: string;
  pin?: string;
  reason?: string;
  /** What happened to their parent's login, when the row named one: a new
   *  login comes with a temporary password, in case the welcome email
   *  doesn't reach them. */
  parent?: { email: string; status: "created" | "linked" | "failed"; reason?: string; temp_password?: string };
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const initials = (name: string) => name.trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase();
const randomPin = () => String(1000 + (randomBytes(2).readUInt16BE(0) % 9000));

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;
  const { caller, user } = auth;
  const schoolId = caller.school_id as string | null;
  if (!schoolId) return NextResponse.json({ error: "Your account isn't linked to a school" }, { status: 403 });

  const body = (await req.json().catch(() => null)) ?? {};
  const rows: ImportRow[] | null = Array.isArray(body.rows) ? body.rows : null;
  if (!rows || rows.length === 0) return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Send at most ${MAX_ROWS} rows at a time` }, { status: 400 });

  const admin = createAdminClient();
  try {
    // What the school already has: whether it keeps grades, its campuses,
    // halaqas and students. Each optional part is absent until the grades
    // update has been run.
    const [{ data: school }, { data: graded }, campusList, halaqaList, { data: studentRows, error: studentsError }] =
      await Promise.all([
        admin.from("schools").select("name").eq("id", schoolId).maybeSingle(),
        admin.from("schools").select("organised_by_grade").eq("id", schoolId).maybeSingle(),
        admin.from("campuses").select("id, name").eq("school_id", schoolId),
        admin.from("classes").select("id, name, grade, campus_id").eq("school_id", schoolId),
        admin.from("students").select("id, full_name, grade").eq("school_id", schoolId),
      ]);
    if (studentsError) throw studentsError;
    const byGrade = graded?.organised_by_grade === true;
    const campusesReady = !campusList.error;
    const campuses = (campusList.data ?? []) as Array<{ id: string; name: string }>;
    const halaqas = ((halaqaList.data ?? []) as Array<{ id: string; name: string; grade: number; campus_id?: string | null }>).map((h) => ({
      ...h,
      campus_id: h.campus_id ?? null,
    }));
    if (halaqaList.error) {
      // Before the grades update: halaqas have no campus yet.
      const { data, error } = await admin.from("classes").select("id, name, grade").eq("school_id", schoolId);
      if (error) throw error;
      halaqas.push(...((data ?? []) as Array<{ id: string; name: string; grade: number }>).map((h) => ({ ...h, campus_id: null })));
    }
    const halaqaOfStudent = new Map<string, string>();
    if (halaqas.length > 0) {
      const { data: enrolments, error } = await admin
        .from("class_enrollments")
        .select("class_id, student_id")
        .in("class_id", halaqas.map((h) => h.id));
      if (error) throw error;
      for (const e of (enrolments ?? []) as Array<{ class_id: string; student_id: string }>) halaqaOfStudent.set(e.student_id, e.class_id);
    }
    const students = ((studentRows ?? []) as Array<{ id: string; full_name: string; grade: number }>).map((s) => ({
      ...s,
      halaqa: halaqaOfStudent.get(s.id) ?? null,
    }));

    const campusFor = async (name: string): Promise<{ id: string; name: string } | null> => {
      if (!name.trim()) return campuses.length === 1 ? campuses[0] : null;
      const found = campuses.find((c) => key(c.name) === key(name));
      if (found) return found;
      if (!campusesReady) throw new Error("This school can't have campuses until the grades update is run in Supabase");
      const { data, error } = await admin.from("campuses").insert({ school_id: schoolId, name: name.trim().slice(0, 60) }).select("id, name").single();
      if (error) throw error;
      campuses.push(data);
      return data;
    };

    const halaqaFor = async (name: string, grade: number, campusId: string | null) => {
      const found = halaqas.find(
        (h) => key(h.name) === key(name) && (!byGrade || h.grade === grade) && (campuses.length === 0 || h.campus_id === campusId)
      );
      if (found) return found;
      const { data, error } = await admin
        .from("classes")
        .insert({
          name: name.trim(),
          subject: "Qur'an & Hifz",
          grade: byGrade ? grade : 0,
          schedule: "",
          teacher_id: null,
          school_id: schoolId,
          ...(campusId ? { campus_id: campusId } : {}),
        })
        .select("id, name, grade")
        .single();
      if (error) throw error;
      const made = { ...data, campus_id: campusId };
      halaqas.push(made);
      return made;
    };

    // A parent once per batch, however many of their children are in it.
    type ParentOutcome = { id: string | null; status: "created" | "linked" | "failed"; reason?: string; password?: string };
    const parentsSeen = new Map<string, ParentOutcome>();
    const welcomes: NewAccount[] = [];
    const parentFor = async (row: ImportRow, childName: string) => {
      const email = key(row.parentEmail);
      const seen = parentsSeen.get(email);
      if (seen) return { email, ...seen };
      const { data: holder } = await admin.from("profiles").select("id, role, school_id, full_name").eq("email", email).maybeSingle();
      let result: ParentOutcome;
      if (holder) {
        result =
          holder.school_id === schoolId && holder.role === "parent"
            ? { id: holder.id, status: "linked" }
            : {
                id: null,
                status: "failed",
                reason:
                  holder.school_id === schoolId
                    ? `${email} is ${holder.full_name || "someone"}'s ${holder.role} login here, so it can't also be a parent's`
                    : `${email} already has a MyDiiwaan login at another school`,
              };
      } else {
        const name = String(row.parentName ?? "").trim() || `${childName}'s parent`;
        const password = randomBytes(9).toString("base64url");
        const { data, error } = await createProvisionedUser(admin, {
          email,
          password,
          user_metadata: { role: "parent", full_name: name, school_id: schoolId, must_change_password: true },
        });
        if (error || !data.user) {
          result = { id: null, status: "failed", reason: error?.message ?? "Couldn't make their login" };
        } else {
          result = { id: data.user.id, status: "created", password };
          welcomes.push({ userId: data.user.id, name, email, role: "parent", children: [] });
        }
      }
      parentsSeen.set(email, result);
      return { email, ...result };
    };

    const results: RowResult[] = [];
    for (const row of rows) {
      const name = String(row?.name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (!name) {
        results.push({ status: "failed", name: "", reason: "No name" });
        continue;
      }
      try {
        const grade = byGrade ? row.grade : 0;
        if (byGrade && !isGrade(grade)) {
          results.push({ status: "failed", name, reason: "No grade — give Kindergarten (K) or a grade from 1 to 12" });
          continue;
        }
        const halaqaName = String(row.halaqa ?? "").trim();
        const campusName = String(row.campus ?? "").trim();
        const campus = halaqaName || campusName ? await campusFor(campusName) : null;
        if (halaqaName && campuses.length > 1 && !campus) {
          results.push({ status: "failed", name, reason: "Which campus? The school has more than one — fill in the Campus column" });
          continue;
        }
        const halaqa = halaqaName ? await halaqaFor(halaqaName, grade as number, campus?.id ?? null) : null;
        const place = [campus?.name && campuses.length > 0 ? campus.name : null, byGrade ? gradeLabel(grade as number) : null, halaqa?.name]
          .filter(Boolean)
          .join(" · ");

        // Already here — the same sheet imported twice, or a child added by hand.
        const already = students.find(
          (s) => key(s.full_name) === key(name) && (!byGrade || s.grade === grade) && (!halaqa || s.halaqa === halaqa.id)
        );
        if (already) {
          results.push({ status: "skipped", name, place, reason: "Already at the school" });
          continue;
        }

        const { data: student, error: studentError } = await admin
          .from("students")
          .insert({
            full_name: name,
            grade: byGrade ? grade : 0,
            avatar_initials: initials(name),
            avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
            school_id: schoolId,
          })
          .select("id")
          .single();
        if (studentError) throw studentError;

        // Their sign-in: four digits on the school's login screen.
        const pin = randomPin();
        const { data: login, error: loginError } = await createProvisionedUser(admin, {
          email: studentLoginEmail(student.id),
          password: studentLoginPassword(student.id, pin),
          user_metadata: { role: "student", full_name: name, school_id: schoolId },
        });
        if (loginError || !login.user) {
          await admin.from("students").delete().eq("id", student.id);
          throw new Error(loginError?.message ?? "Couldn't make their sign-in");
        }
        const { error: linkError } = await admin.from("students").update({ pin, profile_id: login.user.id }).eq("id", student.id);
        if (linkError) throw linkError;
        if (halaqa) {
          const { error } = await admin.from("class_enrollments").insert({ class_id: halaqa.id, student_id: student.id });
          if (error) throw error;
        }
        students.push({ id: student.id, full_name: name, grade: grade as number, halaqa: halaqa?.id ?? null });

        const result: RowResult = { status: "added", name, place, pin };
        const parentEmail = key(String(row.parentEmail ?? ""));
        if (parentEmail) {
          if (!EMAIL.test(parentEmail)) {
            result.parent = { email: parentEmail, status: "failed", reason: "That isn't an email address" };
          } else {
            const parent = await parentFor(row, name);
            if (parent.id) {
              const { error } = await admin.from("parent_students").insert({ parent_id: parent.id, student_id: student.id });
              if (error && error.code !== "23505") throw error;
              welcomes.find((w) => w.userId === parent.id)?.children?.push(name);
            }
            result.parent = {
              email: parent.email,
              status: parent.status,
              ...(parent.reason ? { reason: parent.reason } : {}),
              ...(parent.password ? { temp_password: parent.password } : {}),
            };
          }
        }
        results.push(result);
      } catch (error) {
        console.error(`Import: "${name}" failed`, error);
        results.push({ status: "failed", name, reason: error instanceof Error ? error.message : "Couldn't add them" });
      }
    }

    // Each new parent's welcome, with a link to choose their password —
    // after the answer, so the office isn't kept waiting on email.
    if (welcomes.length > 0) {
      after(() => sendAccountWelcomes(welcomes, { name: school?.name ?? "Your school", replyTo: user.email }));
    }
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Import: batch failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The import failed" }, { status: 500 });
  }
}
