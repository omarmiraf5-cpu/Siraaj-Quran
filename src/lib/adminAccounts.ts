import "server-only";

import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";

type SessionDb = Awaited<ReturnType<typeof createClient>>;
type ServiceDb = ReturnType<typeof createAdminClient>;

/** The accounts the office manages from its Teachers and Parents pages. */
export const ACCOUNT_ROLES = ["teacher", "parent"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

// Every office account route starts the same way: prove there's a session,
// and that it belongs to an admin. Shared so no route can drift into being
// more permissive than the others.
export async function requireAdmin(supabase: SessionDb) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: caller, error: callerError } = await supabase
    .from("profiles")
    .select("role, school_id")
    .eq("id", user.id)
    .single();

  if (callerError || !caller || caller.role !== "admin") {
    // This 403 has fired for accounts that really were role='admin' in the
    // table, so the generic message alone wasn't enough to tell a missing
    // row apart from a wrong role apart from an RLS/session problem. Log
    // the real cause server-side and echo a short hint in the response so
    // it's visible without needing Vercel log access.
    console.error("Admin check failed:", {
      userId: user.id,
      callerError: callerError?.message,
      callerErrorCode: callerError?.code,
      caller,
    });
    return {
      error: NextResponse.json(
        {
          error: "Only an admin can manage accounts",
          debug: callerError
            ? `${callerError.code ?? ""} ${callerError.message}`.trim()
            : caller
            ? `signed-in account has role "${caller.role}", not admin`
            : "no profile row is visible for this session",
        },
        { status: 403 }
      ),
    };
  }

  return { caller, user };
}

/**
 * A teacher's or parent's account in the caller's school. Read with the
 * service role, then checked against the caller's school here: going
 * through the admin's own session instead would make "not in your school"
 * and "no such account" look identical, and the first has to be refused
 * loudly.
 */
export async function schoolAccount(admin: ServiceDb, caller: { school_id: string | null }, id: string) {
  const { data: target, error } = await admin
    .from("profiles")
    .select("id, role, school_id, full_name, email, active")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!target) {
    return { error: NextResponse.json({ error: "No such account" }, { status: 404 }) };
  }
  if (target.school_id !== caller.school_id) {
    return { error: NextResponse.json({ error: "That account belongs to a different school" }, { status: 403 }) };
  }
  if (!ACCOUNT_ROLES.includes(target.role as AccountRole)) {
    return { error: NextResponse.json({ error: `A ${target.role} account can't be changed here` }, { status: 400 }) };
  }
  return { target };
}
