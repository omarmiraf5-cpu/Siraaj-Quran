import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { MAX_ACCURACY_M, formatDistance } from "@/lib/attendanceRules";
import { isError, requireMember, type Db } from "@/lib/attendanceServer";

/**
 * Where the school is and when staff are due — what every sign-in is
 * checked against. Admin-only, through the admin's own session: the
 * existing "Admins can update own school" policy is what allows it.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// PATCH { latitude?, longitude?, accuracy?, radius_m?, start_time?, grace_minutes? }
export async function PATCH(req: NextRequest) {
  const supabase = (await createClient()) as unknown as Db;
  const me = await requireMember(supabase, ["admin"]);
  if (isError(me)) return me.error;

  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const patch: Record<string, unknown> = {};

    if (body.latitude !== undefined || body.longitude !== undefined) {
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return NextResponse.json({ error: "That isn't a valid location" }, { status: 400 });
      }
      // Set from "use my current location": a vague fix would put the
      // school's pin somewhere down the road, and every sign-in after that
      // would be measured from the wrong spot.
      if (body.accuracy !== undefined && Number(body.accuracy) > MAX_ACCURACY_M) {
        return NextResponse.json(
          {
            error: `Your device could only place you to within ${formatDistance(Number(body.accuracy))}. Try again on a phone with location turned on, standing at the school, or type the coordinates in from a map.`,
          },
          { status: 400 }
        );
      }
      patch.latitude = latitude;
      patch.longitude = longitude;
    }
    if (body.radius_m !== undefined) {
      const r = Math.round(Number(body.radius_m));
      if (!(r >= 25 && r <= 2000)) {
        return NextResponse.json({ error: "The premises radius must be between 25 m and 2 km" }, { status: 400 });
      }
      patch.geofence_radius_m = r;
    }
    if (body.start_time !== undefined) {
      if (!TIME.test(String(body.start_time))) {
        return NextResponse.json({ error: "Start time must look like 09:00" }, { status: 400 });
      }
      patch.staff_start_time = body.start_time;
    }
    if (body.grace_minutes !== undefined) {
      const g = Math.round(Number(body.grace_minutes));
      if (!(g >= 0 && g <= 120)) {
        return NextResponse.json({ error: "Grace minutes must be between 0 and 120" }, { status: 400 });
      }
      patch.staff_late_grace_minutes = g;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
    }

    const { data, error } = await supabase.from("schools").update(patch).eq("id", me.school_id).select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Your account can't change the school's settings" }, { status: 403 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Staff attendance: could not save settings", error);
    return NextResponse.json({ error: "Could not save the settings" }, { status: 500 });
  }
}
