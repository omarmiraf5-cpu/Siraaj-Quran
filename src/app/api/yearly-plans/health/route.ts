import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { verifyEncryptionKey } from "@/lib/planCrypto";
import { MILESTONES, PLANS, isFailure, requireTeacher } from "@/lib/yearlyPlanServer";

/**
 * Whether the yearly-plan module is actually ready to use.
 *
 * Setting it up is two separate jobs in two separate places — an
 * encryption key in the hosting environment, and the schema in the
 * database — and getting one right while missing the other produces
 * exactly the same blank page. This says which of the two is outstanding
 * instead of leaving somebody to guess by trial and redeploy.
 *
 * Staff only, and deliberately says nothing a staff member could not work
 * out from the pages themselves: whether a key is set, never any part of
 * it; whether the tables exist, never what is in them.
 */
export async function GET() {
  const supabase = await createClient();
  const caller = await requireTeacher(supabase);
  if (isFailure(caller)) return caller.error;

  // A real encrypt/decrypt round trip, not a length check on the env var:
  // a key that parses to 32 bytes and still cannot open what it sealed is
  // precisely the failure this is here to catch.
  const encryption = verifyEncryptionKey();

  // `head: true` asks for the count without the rows, so this cannot
  // become a way to read plan data through a diagnostic endpoint.
  const [plans, milestones] = await Promise.all([
    supabase.from(PLANS).select("id", { count: "exact", head: true }),
    supabase.from(MILESTONES).select("id", { count: "exact", head: true }),
  ]);

  // 42P01 is Postgres for "relation does not exist" — the signature of a
  // database that has not had the schema applied yet, as distinct from
  // one where RLS simply returned nothing.
  const missingTable =
    plans.error?.code === "42P01" ||
    milestones.error?.code === "42P01" ||
    /does not exist/i.test(plans.error?.message ?? "");

  const schemaOk = !plans.error && !milestones.error;
  const ready = encryption.ok && schemaOk;

  return NextResponse.json(
    {
      ready,
      encryption_key: {
        ok: encryption.ok,
        detail: encryption.detail,
        fix: encryption.ok
          ? null
          : "Set PLAN_ENCRYPTION_KEY in the hosting environment, then redeploy. A value is only picked up by a new deployment.",
      },
      database: {
        ok: schemaOk,
        detail: schemaOk
          ? `tables present — ${plans.count ?? 0} plan(s), ${milestones.count ?? 0} milestone(s) visible to you`
          : missingTable
            ? "the yearly-plan tables do not exist yet"
            : (plans.error?.message ?? milestones.error?.message ?? "unreadable"),
        fix: schemaOk
          ? null
          : "Run supabase/schema.sql in the Supabase SQL editor. It is safe to run in full — every statement is guarded.",
      },
      next_step: ready
        ? null
        : !encryption.ok
          ? "Add the encryption key and redeploy."
          : "Apply the database schema.",
    },
    // 503 while incomplete, so this can be watched by something that only
    // understands status codes.
    { status: ready ? 200 : 503 }
  );
}
