import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember, isError } from "@/lib/attendanceServer";
import { TERMS_VERSION } from "@/lib/site";

// What the school has agreed to: MyDiiwaan's terms and school data
// agreement (which version, when, by whom), and its confirmation that it
// has parents' agreement to their children's records being kept here.
// Recorded by the server, so the date and the admin are the real ones.

export interface Agreements {
  /** False before the database has the columns (update 12). */
  available: boolean;
  termsVersion: string;
  termsAccepted: boolean;
  termsAcceptedAt: string | null;
  consentConfirmed: boolean;
  consentConfirmedAt: string | null;
}

async function read(schoolId: string): Promise<Agreements> {
  const { data, error } = await createAdminClient()
    .from("schools")
    .select("terms_accepted_at, terms_version, parent_consent_confirmed_at")
    .eq("id", schoolId)
    .maybeSingle();
  if (error) {
    return { available: false, termsVersion: TERMS_VERSION, termsAccepted: true, termsAcceptedAt: null, consentConfirmed: true, consentConfirmedAt: null };
  }
  return {
    available: true,
    termsVersion: TERMS_VERSION,
    termsAccepted: !!data?.terms_accepted_at && data.terms_version === TERMS_VERSION,
    termsAcceptedAt: (data?.terms_accepted_at as string | null) ?? null,
    consentConfirmed: !!data?.parent_consent_confirmed_at,
    consentConfirmedAt: (data?.parent_consent_confirmed_at as string | null) ?? null,
  };
}

export async function GET() {
  const member = await requireMember(await createClient(), ["admin"]);
  if (isError(member)) return member.error;
  return NextResponse.json(await read(member.school_id));
}

/** POST { accept: "terms" | "consent" } */
export async function POST(req: NextRequest) {
  const member = await requireMember(await createClient(), ["admin"]);
  if (isError(member)) return member.error;
  const { accept } = (await req.json().catch(() => ({}))) as { accept?: unknown };
  const now = new Date().toISOString();
  const change =
    accept === "terms"
      ? { terms_accepted_at: now, terms_version: TERMS_VERSION, terms_accepted_by: member.id }
      : accept === "consent"
        ? { parent_consent_confirmed_at: now, parent_consent_confirmed_by: member.id }
        : null;
  if (!change) return NextResponse.json({ error: "Accept what?" }, { status: 400 });
  const { error } = await createAdminClient().from("schools").update(change).eq("id", member.school_id);
  if (error) {
    const missing = /column|schema cache/i.test(error.message);
    return NextResponse.json(
      { error: missing ? "This needs the latest database update (mydiiwaan-update-12.sql) run in Supabase first." : error.message },
      { status: missing ? 409 : 500 }
    );
  }
  return NextResponse.json(await read(member.school_id));
}
