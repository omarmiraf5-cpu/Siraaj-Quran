import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import type { Db } from "@/lib/attendanceServer";
import { sendWeeklyReports } from "@/lib/weeklyReportSend";

// Friday afternoon's weekly progress reports (vercel.json schedules it).
// Vercel sends the project's CRON_SECRET with the call; without it set,
// nothing is sent at all, so the reports can't be set off by anyone else.

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET isn't set for this deployment, so no reports are sent." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = await sendWeeklyReports(createAdminClient() as unknown as Db);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Weekly reports failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Weekly reports failed" }, { status: 500 });
  }
}
