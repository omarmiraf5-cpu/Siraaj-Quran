import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Creating a teacher account needs Supabase's admin API (to create the
// auth.users row and send the invite email), which requires the
// service-role key — a normal, RLS-scoped session can never do this on its
// own, so this always goes through the server, never a direct client call.
export async function POST(req: NextRequest) {
  const supabase = await createClient();

  try {
    const { full_name, email } = await req.json();
    if (!full_name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "full_name and email are required" },
        { status: 400 }
      );
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: caller } = await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("id", user.id)
      .single();

    if (!caller || caller.role !== "admin") {
      return NextResponse.json(
        { error: "Only an admin can add a teacher" },
        { status: 403 }
      );
    }

    // The on_auth_user_created trigger reads this metadata to fill in the
    // new profiles row, so the invited teacher lands in the right school
    // with the right role as soon as they accept.
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(
      email.trim(),
      {
        data: {
          role: "teacher",
          full_name: full_name.trim(),
          school_id: caller.school_id,
        },
      }
    );

    if (error) throw error;

    return NextResponse.json(
      { id: data.user.id, email: data.user.email },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inviting teacher:", error);
    const message = error instanceof Error ? error.message : "Failed to invite teacher";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
