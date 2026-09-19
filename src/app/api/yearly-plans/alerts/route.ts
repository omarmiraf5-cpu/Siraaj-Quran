import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { ALERTS, isFailure, requireCaller, routeError } from "@/lib/yearlyPlanServer";

/**
 * Acknowledging an alert — what dismissing the banner writes.
 *
 * Open to parents as well as staff, because the banner they are dismissing
 * is on their own child's page. The row boundary is enforced by RLS (a
 * parent's UPDATE only reaches their own children's rows); what this route
 * adds is the column boundary. Postgres has no column-level grant inside a
 * policy, so without this handler a parent holding the anon key could
 * PATCH resolved_on or level directly and quietly clear a warning the
 * school needs to see. Only acknowledged_at is ever written here.
 *
 * Acknowledging is not resolving. The alert stays open and stays on the
 * teacher's side of the app; the parent has only said they have read it.
 */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const caller = await requireCaller(supabase);
  if (isFailure(caller)) return caller.error;

  try {
    const body = await req.json();
    const { id, acknowledged } = body ?? {};
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // An alert the sweep could not persist is handed to the page with a
    // synthetic id. There is no row to write to, so say so plainly rather
    // than returning a 404 that looks like a permissions problem.
    if (typeof id === "string" && id.startsWith("unsaved:")) {
      return NextResponse.json(
        { error: "This alert has not been saved yet and cannot be dismissed" },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from(ALERTS)
      .update({
        acknowledged_at: acknowledged === false ? null : new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, acknowledged_at");
    if (error) throw error;

    // Zero rows back means RLS refused it — the alert belongs to another
    // family's child, or to another school. Reported as "not found" for
    // the same reason the GET does: the alternative confirms it exists.
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "No such alert" }, { status: 404 });
    }

    return NextResponse.json({ id: data[0].id, acknowledged_at: data[0].acknowledged_at });
  } catch (error) {
    return routeError("acknowledge the alert", error);
  }
}
