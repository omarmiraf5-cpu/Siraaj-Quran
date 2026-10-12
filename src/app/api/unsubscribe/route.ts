import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validUnsubscribe } from "@/lib/unsubscribe";

// Unsubscribing a parent from the Friday progress emails, from the signed
// link in one (the confirm page, or a mail app's one-click button), or
// subscribing them again from the same page. Only ever a POST: a link
// scanner opening the address mustn't unsubscribe anyone.

/** POST ?u=&t=[&again=1] (the body is ignored, as one-click sends a form) */
export async function POST(req: NextRequest) {
  const u = req.nextUrl.searchParams.get("u") ?? "";
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!validUnsubscribe(u, t)) return NextResponse.json({ error: "This link isn't valid" }, { status: 400 });
  const again = req.nextUrl.searchParams.get("again") === "1";
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ weekly_reports_off_at: again ? null : new Date().toISOString() })
    .eq("id", u)
    .eq("role", "parent");
  if (error) {
    console.error("Unsubscribe: couldn't save", error);
    return NextResponse.json({ error: "That didn't save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, subscribed: again });
}
