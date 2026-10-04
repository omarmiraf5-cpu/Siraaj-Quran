import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAccounts";

// A halaqa's other teachers (class_teachers), as the office sets them on the
// Halaqas page. Through the server because one of them can be an admin who
// teaches, and the table's own policy lets the office's session add only
// teachers' logins. The same checks are made here instead: the caller runs
// the halaqa's school, and everyone named is one of its teachers or admins.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEACHERS = 20;

// PUT { class_id, teacher_ids } — exactly these, besides its first teacher.
export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;
  const { caller } = auth;
  if (!caller.school_id) {
    return NextResponse.json({ error: "Your account isn't linked to a school" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) ?? {};
  const classId = typeof body.class_id === "string" ? body.class_id : "";
  const asked: unknown[] | null = Array.isArray(body.teacher_ids) ? body.teacher_ids : null;
  if (!UUID.test(classId) || !asked || !asked.every((id) => typeof id === "string" && UUID.test(id))) {
    return NextResponse.json({ error: "class_id and teacher_ids are required" }, { status: 400 });
  }
  if (asked.length > MAX_TEACHERS) {
    return NextResponse.json({ error: `A halaqa can have up to ${MAX_TEACHERS} teachers` }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: halaqa, error: halaqaError } = await admin
      .from("classes")
      .select("id, teacher_id")
      .eq("id", classId)
      .eq("school_id", caller.school_id)
      .maybeSingle();
    if (halaqaError) throw halaqaError;
    if (!halaqa) {
      return NextResponse.json({ error: "That halaqa isn't one of your school's" }, { status: 404 });
    }

    // Its first teacher is on the halaqa itself, not in here as well.
    const ids = [...new Set(asked as string[])].filter((id) => id !== halaqa.teacher_id);
    if (ids.length > 0) {
      const { data: staff, error: staffError } = await admin
        .from("profiles")
        .select("id")
        .in("id", ids)
        .eq("school_id", caller.school_id)
        .in("role", ["teacher", "admin"]);
      if (staffError) throw staffError;
      if ((staff ?? []).length !== ids.length) {
        return NextResponse.json({ error: "Only your school's teachers and admins can teach its halaqas" }, { status: 400 });
      }
    }

    // Whoever is no longer on it goes, and whoever is new joins; everyone
    // staying keeps their row, so the halaqa is never left without them.
    const { data: current, error: currentError } = await admin
      .from("class_teachers")
      .select("teacher_id")
      .eq("class_id", classId);
    if (currentError) throw currentError;
    const had = (current ?? []).map((r: { teacher_id: string }) => r.teacher_id);
    const gone = had.filter((id) => !ids.includes(id));
    const added = ids.filter((id) => !had.includes(id));
    if (gone.length > 0) {
      const { error } = await admin.from("class_teachers").delete().eq("class_id", classId).in("teacher_id", gone);
      if (error) throw error;
    }
    if (added.length > 0) {
      const { error } = await admin
        .from("class_teachers")
        .upsert(
          added.map((teacher_id) => ({ class_id: classId, teacher_id })),
          { onConflict: "class_id,teacher_id", ignoreDuplicates: true }
        );
      if (error) throw error;
    }
    return NextResponse.json({ ok: true, teacher_ids: ids });
  } catch (error) {
    console.error("Halaqa teachers: could not save", error);
    return NextResponse.json({ error: "Couldn't save the halaqa's teachers" }, { status: 500 });
  }
}
