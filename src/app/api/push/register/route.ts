import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// The app tells the portal which phone to send this person's notices to.
// A token belongs to one person at a time: signing in on the same phone as
// somebody else moves it to the new person.
async function who() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase.from("profiles").select("role, school_id").eq("id", user.id).maybeSingle();
  return me ? { id: user.id, role: String(me.role), school_id: (me.school_id as string | null) ?? null } : null;
}

export async function POST(req: NextRequest) {
  const me = await who();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Children are not sent notifications: they sign in with a PIN, and their
  // parents hear about their work.
  if (me.role === "student") return NextResponse.json({ ok: true, skipped: true });

  const { token, platform } = (await req.json().catch(() => ({}))) as { token?: unknown; platform?: unknown };
  const t = String(token ?? "").trim();
  if (t.length < 20 || t.length > 4096 || (platform !== "ios" && platform !== "android")) {
    return NextResponse.json({ error: "A device token and platform are required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("push_devices")
    .upsert({ user_id: me.id, school_id: me.school_id, platform, token: t, last_seen: new Date().toISOString() }, { onConflict: "token" });
  if (error) {
    console.error("Push: could not save a device", error);
    return NextResponse.json({ error: "Couldn't save this phone" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const me = await who();
  if (!me) return NextResponse.json({ ok: true });
  const { token } = (await req.json().catch(() => ({}))) as { token?: unknown };
  const admin = createAdminClient();
  await admin.from("push_devices").delete().eq("user_id", me.id).eq("token", String(token ?? ""));
  return NextResponse.json({ ok: true });
}
