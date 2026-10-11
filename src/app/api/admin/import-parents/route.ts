import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/adminAccounts";
import { sendAccountWelcomes } from "@/lib/accountWelcome";
import { parentLoginsFor } from "@/lib/parentLogins";

// Parents for students already at the school, from a spreadsheet: each row
// a child's name and their parent's name and email. The child is found by
// name (and halaqa, when two share a name); the parent is linked if they
// have a login here already, or given one and emailed a welcome. Sent a
// batch at a time from the Parents page, a parent's rows kept together.

export const maxDuration = 60;
const MAX_ROWS = 25;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const key = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export interface ParentRow {
  child: string;
  halaqa?: string;
  parentName: string;
  parentEmail: string;
}

export interface ParentRowResult {
  child: string;
  status: "linked" | "already" | "failed";
  /** The student it was matched to, as the school has their name. */
  student?: string;
  reason?: string;
  parent?: { email: string; status: "created" | "linked" | "failed"; reason?: string; temp_password?: string };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;
  const { caller, user } = auth;
  const schoolId = caller.school_id as string | null;
  if (!schoolId) return NextResponse.json({ error: "Your account isn't linked to a school" }, { status: 403 });

  const body = (await req.json().catch(() => null)) ?? {};
  const rows: ParentRow[] | null = Array.isArray(body.rows) ? body.rows : null;
  if (!rows || rows.length === 0) return NextResponse.json({ error: "No rows to import" }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `At most ${MAX_ROWS} rows at a time` }, { status: 400 });

  const admin = createAdminClient();
  try {
    // The school's students, a thousand at a time, and the halaqas they're in.
    const students: Array<{ id: string; full_name: string }> = [];
    for (let i = 0; ; i += 1000) {
      const { data, error } = await admin
        .from("students")
        .select("id, full_name")
        .eq("school_id", schoolId)
        .eq("active", true)
        .order("id")
        .range(i, i + 999);
      if (error) throw error;
      students.push(...((data ?? []) as typeof students));
      if ((data ?? []).length < 1000) break;
    }
    const byName = new Map<string, Array<{ id: string; full_name: string }>>();
    for (const s of students) byName.set(key(s.full_name), [...(byName.get(key(s.full_name)) ?? []), s]);

    let halaqaOf: Map<string, string[]> | null = null;
    const halaqasOf = async (ids: string[]) => {
      if (!halaqaOf) {
        const { data: classes } = await admin.from("classes").select("id, name").eq("school_id", schoolId);
        const names = new Map(((classes ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, key(c.name)]));
        const { data: enrolments } = await admin.from("class_enrollments").select("student_id, class_id").in("class_id", [...names.keys()]);
        halaqaOf = new Map();
        for (const e of (enrolments ?? []) as Array<{ student_id: string; class_id: string }>) {
          halaqaOf.set(e.student_id, [...(halaqaOf.get(e.student_id) ?? []), names.get(e.class_id) ?? ""]);
        }
      }
      return ids.map((id) => halaqaOf!.get(id) ?? []);
    };

    const parents = parentLoginsFor(admin, schoolId);
    const results: ParentRowResult[] = [];
    for (const row of rows) {
      const child = String(row?.child ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      const email = key(row?.parentEmail ?? "");
      if (!child) {
        results.push({ child: "", status: "failed", reason: "No child's name" });
        continue;
      }
      if (!EMAIL.test(email)) {
        results.push({ child, status: "failed", reason: email ? "That isn't an email address" : "No parent email" });
        continue;
      }
      let matches = byName.get(key(child)) ?? [];
      if (matches.length > 1 && row.halaqa) {
        const theirs = await halaqasOf(matches.map((m) => m.id));
        matches = matches.filter((_, i) => theirs[i].includes(key(row.halaqa ?? "")));
      }
      if (matches.length === 0) {
        results.push({
          child,
          status: "failed",
          reason: (byName.get(key(child)) ?? []).length > 1 ? `No ${child} in halaqa "${row.halaqa}"` : `No student called ${child} at the school`,
        });
        continue;
      }
      if (matches.length > 1) {
        results.push({ child, status: "failed", reason: `${matches.length} students are called ${child} — add their Halaqa column to tell them apart` });
        continue;
      }
      const student = matches[0];
      try {
        const parent = await parents.forEmail(email, row.parentName, student.full_name);
        if (!parent.id) {
          results.push({ child, student: student.full_name, status: "failed", reason: parent.reason, parent: { email, status: "failed", reason: parent.reason } });
          continue;
        }
        const { error: linkError } = await admin.from("parent_students").insert({ parent_id: parent.id, student_id: student.id });
        const already = linkError?.code === "23505";
        if (linkError && !already) throw linkError;
        parents.welcomes.find((w) => w.userId === parent.id)?.children?.push(student.full_name);
        results.push({
          child,
          student: student.full_name,
          status: already ? "already" : "linked",
          parent: { email, status: parent.status, ...(parent.password ? { temp_password: parent.password } : {}) },
        });
      } catch (error) {
        console.error(`Parents import: "${child}" failed`, error);
        results.push({ child, student: student.full_name, status: "failed", reason: error instanceof Error ? error.message : "Couldn't link them" });
      }
    }

    // Each new parent's welcome, naming their children — after the answer.
    if (parents.welcomes.length > 0) {
      const { data: school } = await admin.from("schools").select("name").eq("id", schoolId).maybeSingle();
      after(() => sendAccountWelcomes(parents.welcomes, { name: school?.name ?? "Your school", replyTo: user.email }));
    }
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Parents import failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "The import failed" }, { status: 500 });
  }
}
