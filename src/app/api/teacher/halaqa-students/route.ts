import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isProgramHalaqa } from "@/lib/programHalaqa";
import { NextRequest, NextResponse } from "next/server";

// A teacher puts students into (and takes them out of) a halaqa they teach.
// Teachers can't write enrolments themselves, so it's done here, after
// checking the halaqa really is theirs — as its lead or one of its other
// teachers — and that the student is at the same school.
//
// A child has one halaqa of their own (and any Hifd programs beside it), so a
// teacher can't take a child out of another teacher's halaqa by adding them to
// theirs: that child shows as "in <halaqa>" and is left alone. Moving one is the
// office's job, on the Students page.

type Db = ReturnType<typeof createAdminClient>;

async function authorise(classId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("role, school_id, active").eq("id", user.id).maybeSingle();
  if (!me || !me.school_id || me.active === false || (me.role !== "teacher" && me.role !== "admin")) {
    return { error: NextResponse.json({ error: "Only teachers can do this" }, { status: 403 }) };
  }
  const admin = createAdminClient();
  const { data: halaqa } = await admin.from("classes").select("id, name, school_id, teacher_id").eq("id", classId).maybeSingle();
  if (!halaqa || halaqa.school_id !== me.school_id) {
    return { error: NextResponse.json({ error: "Halaqa not found" }, { status: 404 }) };
  }
  let mine = halaqa.teacher_id === user.id;
  if (!mine) {
    const { data: link } = await admin.from("class_teachers").select("class_id").eq("class_id", classId).eq("teacher_id", user.id).maybeSingle();
    mine = Boolean(link);
  }
  if (!mine) return { error: NextResponse.json({ error: "That isn't your halaqa" }, { status: 403 }) };
  return { admin, schoolId: me.school_id as string, halaqa: halaqa as { id: string; name: string } };
}

/** The non-program halaqa each of these students is in already, by student id. */
async function ownHalaqas(admin: Db, schoolId: string): Promise<Map<string, string>> {
  const { data: classes } = await admin.from("classes").select("id, name").eq("school_id", schoolId);
  const own = new Map(((classes ?? []) as Array<{ id: string; name: string }>).filter((c) => !isProgramHalaqa(c.name)).map((c) => [c.id, c.name]));
  const out = new Map<string, string>();
  if (own.size === 0) return out;
  const { data: rows } = await admin.from("class_enrollments").select("student_id, class_id").in("class_id", [...own.keys()]);
  for (const r of (rows ?? []) as Array<{ student_id: string; class_id: string }>) out.set(r.student_id, own.get(r.class_id) ?? "");
  return out;
}

// GET ?class_id= → the halaqa's children, and the school's other children who could join.
export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get("class_id") ?? "";
  const ok = await authorise(classId);
  if ("error" in ok) return ok.error;
  const { admin, schoolId, halaqa } = ok;
  try {
    const [{ data: students }, { data: members }, elsewhere] = await Promise.all([
      admin.from("students").select("id, full_name, grade").eq("school_id", schoolId).eq("active", true).order("full_name"),
      admin.from("class_enrollments").select("student_id").eq("class_id", classId),
      ownHalaqas(admin, schoolId),
    ]);
    const inHere = new Set(((members ?? []) as Array<{ student_id: string }>).map((m) => m.student_id));
    const program = isProgramHalaqa(halaqa.name);
    const all = (students ?? []) as Array<{ id: string; full_name: string; grade: number | null }>;
    return NextResponse.json({
      halaqa: { id: halaqa.id, name: halaqa.name, program },
      members: all.filter((s) => inHere.has(s.id)).map((s) => ({ id: s.id, name: s.full_name })),
      candidates: all
        .filter((s) => !inHere.has(s.id))
        .map((s) => ({ id: s.id, name: s.full_name, grade: s.grade, elsewhere: program ? null : elsewhere.get(s.id) ?? null })),
    });
  } catch (error) {
    console.error("Halaqa students: could not load", error);
    return NextResponse.json({ error: "Couldn't load the students" }, { status: 500 });
  }
}

// POST { class_id, student_id } — add a child.
export async function POST(req: NextRequest) {
  const { class_id, student_id } = (await req.json().catch(() => ({}))) as { class_id?: string; student_id?: string };
  const ok = await authorise(String(class_id ?? ""));
  if ("error" in ok) return ok.error;
  const { admin, schoolId, halaqa } = ok;
  try {
    const { data: student } = await admin.from("students").select("id, school_id, active").eq("id", String(student_id ?? "")).maybeSingle();
    if (!student || student.school_id !== schoolId || student.active === false) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }
    if (!isProgramHalaqa(halaqa.name)) {
      const elsewhere = (await ownHalaqas(admin, schoolId)).get(student.id as string);
      if (elsewhere && elsewhere !== halaqa.name) {
        return NextResponse.json({ error: `Already in ${elsewhere}. The school office can move them.` }, { status: 409 });
      }
    }
    const { error } = await admin.from("class_enrollments").upsert({ class_id: halaqa.id, student_id: student.id }, { onConflict: "class_id,student_id", ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Halaqa students: could not add", error);
    return NextResponse.json({ error: "Couldn't add them. Please try again." }, { status: 500 });
  }
}

// DELETE { class_id, student_id } — take a child out.
export async function DELETE(req: NextRequest) {
  const { class_id, student_id } = (await req.json().catch(() => ({}))) as { class_id?: string; student_id?: string };
  const ok = await authorise(String(class_id ?? ""));
  if ("error" in ok) return ok.error;
  const { admin, halaqa } = ok;
  try {
    const { error } = await admin.from("class_enrollments").delete().eq("class_id", halaqa.id).eq("student_id", String(student_id ?? ""));
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Halaqa students: could not remove", error);
    return NextResponse.json({ error: "Couldn't remove them. Please try again." }, { status: 500 });
  }
}
