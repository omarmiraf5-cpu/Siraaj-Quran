import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// A child has to find themselves on the login screen before they've signed
// in, so this one endpoint is readable without a session. It is deliberately
// narrow: given a school's slug it returns first names and avatars for that
// school's active students and nothing else — no surnames, no contact
// details, no grades, and nothing at all without the right slug.
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
      .select("id, full_name, avatar_initials, avatar_color, pin")
      .eq("school_id", school.id)
      .eq("active", true)
      .order("full_name");

    return NextResponse.json({
      school: { name: school.name },
      // Only students who've actually been given a PIN can sign in, so the
      // rest are left off rather than shown as dead ends. The PIN itself
      // never leaves the server.
      students: (students ?? [])
        .filter((s) => s.pin)
        .map((s) => ({
          id: s.id,
          first_name: (s.full_name ?? "").split(" ")[0],
          initials: s.avatar_initials,
          colour: s.avatar_color,
        })),
    });
  } catch (error) {
    console.error("Error loading student roster:", error);
    return NextResponse.json({ error: "Failed to load roster" }, { status: 500 });
  }
}
