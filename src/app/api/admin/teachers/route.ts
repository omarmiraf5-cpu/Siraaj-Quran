import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// inviteUserByEmail's link lands on whatever Site URL the Supabase project
// has configured, and this app has no page yet that reads an invite token
// from the URL and lets someone set a password — so a real invite email
// would currently dead-end. Creating the account with a temporary password
// instead means the admin can hand it to the teacher and they can sign in
// right away with the existing login form.
function generateTempPassword() {
  return randomBytes(9).toString("base64url");
}

// Creating a teacher account needs Supabase's admin API (to create the
// auth.users row), which requires the service-role key — a normal,
// RLS-scoped session can never do this on its own, so this always goes
// through the server, never a direct client call.
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
    // new profiles row, so the new teacher lands in the right school with
    // the right role as soon as the account exists.
    const admin = createAdminClient();
    const tempPassword = generateTempPassword();
    const { data, error } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: "teacher",
        full_name: full_name.trim(),
        school_id: caller.school_id,
      },
    });

    if (error) throw error;

    return NextResponse.json(
      { id: data.user.id, email: data.user.email, temp_password: tempPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating teacher:", error);
    const message = error instanceof Error ? error.message : "Failed to create teacher";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
