import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isError, requireMember } from "@/lib/attendanceServer";
import { FILE_LIMITS, answerFiles, parseFileRefs, parseNewAssignment, type ClassWorkItem, type StaffAssignment } from "@/lib/classWork";
import { addLinks, namesOf, staffRoster, teacherFilesPrefix, toAssignment, toSubmission } from "@/lib/classWorkServer";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Islamic Studies and Arabic work, as whoever is asking should see it:
 *   teacher / office — the work they set, how many have handed it in and
 *                      been marked, and who they could set new work for;
 *   student          — their own copy of each piece of work;
 *   parent           — each of their children's.
 * Row-level security decides whose rows come back; this only shapes them.
 */
export async function GET() {
  const supabase = await createClient();
  const me = await requireMember(supabase);
  if (isError(me)) return me.error;

  try {
    if (me.role === "teacher" || me.role === "admin") {
      const { data: rows, error } = await supabase
        .from("subject_assignments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (rows ?? []).map((r: any) => r.id);
      const { data: subs } = ids.length
        ? await supabase.from("subject_submissions").select("assignment_id, status").in("assignment_id", ids)
        : { data: [] as any[] };
      const names = await namesOf(supabase, (rows ?? []).map((r: any) => r.created_by));
      const assignments: StaffAssignment[] = (rows ?? []).map((r: any) => {
        const mine = (subs ?? []).filter((s: any) => s.assignment_id === r.id);
        return {
          ...toAssignment(r),
          set_by: r.created_by === me.id ? me.full_name : names.get(r.created_by) ?? null,
          counts: {
            assigned: mine.filter((s: any) => s.status === "assigned").length,
            submitted: mine.filter((s: any) => s.status === "submitted").length,
            graded: mine.filter((s: any) => s.status === "graded").length,
          },
        };
      });
      return NextResponse.json({ role: me.role, assignments, roster: await staffRoster(supabase) });
    }

    // A child's own copies, or a parent's children's — whichever RLS gives.
    const { data: subRows, error } = await supabase
      .from("subject_submissions")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const ids = [...new Set((subRows ?? []).map((s: any) => s.assignment_id))];
    const { data: rows } = ids.length
      ? await supabase.from("subject_assignments").select("*").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((rows ?? []).map((r: any) => [r.id, r]));
    const admin = createAdminClient();
    const names = await namesOf(admin, (rows ?? []).map((r: any) => r.created_by));
    const items: ClassWorkItem[] = (subRows ?? [])
      .filter((s: any) => byId.has(s.assignment_id))
      .map((s: any) => {
        const a = byId.get(s.assignment_id);
        return { assignment: toAssignment(a), submission: toSubmission(s), set_by: names.get(a.created_by) ?? null };
      });
    // The teacher's files, and what each child handed in — all of it theirs
    // (or their children's) to see, as row-level security just decided.
    await addLinks(admin, items.flatMap((i) => [...i.assignment.attachments, ...answerFiles(i.submission.answers)]));

    if (me.role === "parent") {
      const { data: children } = await supabase.from("students").select("id, full_name").order("full_name");
      return NextResponse.json({
        role: me.role,
        children: (children ?? []).map((c: any) => ({ id: c.id, name: c.full_name })),
        items,
      });
    }
    return NextResponse.json({ role: me.role, items });
  } catch (error) {
    console.error("Class work: could not load", error);
    return NextResponse.json({ error: "Couldn't load the assignments. Please try again." }, { status: 500 });
  }
}

/** A teacher or the office sets a new piece of work for some of the school's children. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const me = await requireMember(supabase, ["teacher", "admin"]);
  if (isError(me)) return me.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "That request wasn't readable." }, { status: 400 });
  }
  const parsed = parseNewAssignment(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const a = parsed.value;
  const attachments = parseFileRefs(
    (body as Record<string, unknown>).attachments,
    teacherFilesPrefix(me.school_id),
    FILE_LIMITS.perAssignment
  );
  if (!attachments.ok) return NextResponse.json({ error: attachments.error }, { status: 400 });

  // Only children of the caller's own school, and only ones still enrolled.
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, school_id, active")
    .in("id", a.student_ids);
  if (studentsError) {
    console.error("Class work: could not check students", studentsError);
    return NextResponse.json({ error: "Couldn't set the assignment. Please try again." }, { status: 500 });
  }
  const valid = (students ?? []).filter((s: any) => s.school_id === me.school_id && s.active !== false);
  if (valid.length !== a.student_ids.length) {
    return NextResponse.json({ error: "Some of those students aren't in your school." }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("subject_assignments")
    .insert({
      school_id: me.school_id,
      subject: a.subject,
      title: a.title,
      instructions: a.instructions,
      questions: a.questions,
      max_points: a.max_points,
      due_date: a.due_date,
      created_by: me.id,
      // Only when there are files, so work without any still saves on a
      // database that hasn't had the attachments column added yet.
      ...(attachments.value.length > 0 ? { attachments: attachments.value } : {}),
    })
    .select()
    .single();
  if (error || !row) {
    console.error("Class work: could not create", error);
    return NextResponse.json({ error: "Couldn't set the assignment. Please try again." }, { status: 500 });
  }

  // The key and each child's copy. Should either fail, the assignment goes
  // too, so a teacher never sees work nobody was given.
  const [{ error: keyError }, { error: subsError }] = await Promise.all([
    supabase.from("subject_assignment_keys").insert({ assignment_id: row.id, school_id: me.school_id, answers: a.key }),
    supabase.from("subject_submissions").insert(
      a.student_ids.map((student_id) => ({ assignment_id: row.id, student_id, school_id: me.school_id }))
    ),
  ]);
  if (keyError || subsError) {
    console.error("Class work: could not hand out", keyError ?? subsError);
    await supabase.from("subject_assignments").delete().eq("id", row.id);
    return NextResponse.json({ error: "Couldn't set the assignment. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ assignment: toAssignment(row), students: a.student_ids.length }, { status: 201 });
}
