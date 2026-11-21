import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAll } from "@/lib/supabase/fetchAll";
import { NextRequest, NextResponse } from "next/server";

// A child has to find themselves on the login screen before they've signed
// in, so this one endpoint is readable without a session. It is deliberately
// narrow: given a school's slug it returns first names and avatars for that
// school's active students, and the halaqas they're in so a child can find
// their own class first: each halaqa's name, grade, teacher and class time.
// Nothing else — no surnames, no contact details, no PINs, and nothing at
// all without the right slug.
//
// The trade is that anyone holding a school's slug can see a list of first
// names. For a children's portal where the alternative is asking a
// seven-year-old to type an email address, that is the better side of it.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("school")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "A school is required" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: school } = await admin
      .from("schools")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const { data: students } = await admin
      .from("students")
      .select("id, full_name, avatar_initials, avatar_color, pin, profile_id")
      .eq("school_id", school.id)
      .eq("active", true)
      .order("full_name");

    // Only students who've actually been given a PIN can sign in, so the
    // rest are left off rather than shown as dead ends. The PIN itself
    // never leaves the server.
    const signable = (students ?? []).filter((s) => s.pin && s.profile_id);
    const { halaqas, halaqasOf, graded } = await loadHalaqas(admin, school.id, signable.map((s) => s.id));

    return NextResponse.json({
      school: { name: school.name, graded },
      halaqas,
      students: signable
        .map((s) => ({
          id: s.id,
          // First name and the first letter of the last, so two Mohameds in
          // a big school aren't the same button.
          first_name: (() => {
            const parts = (s.full_name ?? "").trim().split(/\s+/);
            const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
            return last ? `${parts[0]} ${last.toUpperCase()}.` : parts[0];
          })(),
          initials: s.avatar_initials,
          colour: s.avatar_color,
          halaqas: halaqasOf.get(s.id) ?? [],
        })),
    });
  } catch (error) {
    console.error("Error loading student roster:", error);
    return NextResponse.json({ error: "Failed to load roster" }, { status: 500 });
  }
}

type Admin = ReturnType<typeof createAdminClient>;

interface RosterHalaqa {
  id: string;
  name: string;
  grade: number | null;
  campus: string | null;
  teacher: string | null;
  schedule: string | null;
}

/**
 * The school's active halaqas that have at least one of these children in
 * them, with who teaches each and when, and which halaqas each child is in.
 * Anything this can't read (a database from before campuses or grades)
 * leaves that part out, and the login simply shows every name instead.
 */
async function loadHalaqas(admin: Admin, schoolId: string, studentIds: string[]) {
  const empty = { halaqas: [] as RosterHalaqa[], halaqasOf: new Map<string, string[]>(), graded: false };
  if (studentIds.length === 0) return empty;

  type ClassRow = { id: string; name: string; grade: number; schedule: string | null; teacher_id: string | null; campus_id?: string | null };
  const activeClasses = (columns: string) =>
    admin.from("classes").select(columns).eq("school_id", schoolId).eq("active", true).returns<ClassRow[]>();
  const [{ data: shape }, first] = await Promise.all([
    admin.from("schools").select("organised_by_grade").eq("id", schoolId).maybeSingle(),
    activeClasses("id, name, grade, schedule, teacher_id, campus_id"),
  ]);
  // A database from before campuses still has its halaqas.
  const { data: classes, error: classError } = first.error
    ? await activeClasses("id, name, grade, schedule, teacher_id")
    : first;
  if (classError || !classes || classes.length === 0) return empty;
  const graded = (shape as { organised_by_grade?: boolean } | null)?.organised_by_grade === true;

  const classIds = classes.map((c) => c.id);
  const teacherIds = [...new Set(classes.map((c) => c.teacher_id).filter((id): id is string => !!id))];
  const campusIds = [...new Set(classes.map((c) => c.campus_id).filter((id): id is string => !!id))];
  // A big school has more than one page of enrolments.
  const [enrolments, { data: teachers }, { data: campuses }] = await Promise.all([
    fetchAll<{ class_id: string; student_id: string }>((from, to) =>
      admin.from("class_enrollments").select("class_id, student_id").in("class_id", classIds)
        .order("class_id").order("student_id").range(from, to)
    ).catch(() => []),
    teacherIds.length ? admin.from("profiles").select("id, full_name").in("id", teacherIds) : Promise.resolve({ data: [] }),
    campusIds.length ? admin.from("campuses").select("id, name").in("id", campusIds) : Promise.resolve({ data: [] }),
  ]);

  const signable = new Set(studentIds);
  const halaqasOf = new Map<string, string[]>();
  const used = new Set<string>();
  for (const e of enrolments) {
    if (!signable.has(e.student_id)) continue;
    used.add(e.class_id);
    halaqasOf.set(e.student_id, [...(halaqasOf.get(e.student_id) ?? []), e.class_id]);
  }

  const teacherName = new Map((teachers ?? []).map((t: { id: string; full_name: string | null }) => [t.id, t.full_name]));
  const campusName = new Map((campuses ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
  // A school with one campus needn't say which.
  const severalCampuses = new Set(classes.map((c) => c.campus_id).filter(Boolean)).size > 1;

  const halaqas: RosterHalaqa[] = classes
    .filter((c) => used.has(c.id))
    .map((c) => ({
      id: c.id,
      name: c.name,
      grade: graded ? c.grade : null,
      campus: severalCampuses && c.campus_id ? campusName.get(c.campus_id) ?? null : null,
      teacher: c.teacher_id ? teacherName.get(c.teacher_id) ?? null : null,
      schedule: c.schedule?.trim() || null,
    }))
    .sort((a, b) =>
      (a.campus ?? "").localeCompare(b.campus ?? "") ||
      (a.grade ?? 0) - (b.grade ?? 0) ||
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );

  return { halaqas, halaqasOf, graded };
}
