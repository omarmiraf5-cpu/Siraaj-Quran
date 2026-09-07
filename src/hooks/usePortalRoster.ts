"use client";

import { useEffect, useState } from "react";
import {
  DEMO_ATTENDANCE,
  DEMO_CHILDREN,
  DEMO_STUDENTS,
  DEMO_CREATED_ASSIGNMENTS_KEY,
  DEMO_CREATED_STUDENTS_KEY,
  DEMO_STUDENT_OVERRIDES_KEY,
  allStudents,
  demoAssignmentsFor,
  type AttendanceDay,
  type AttendanceStatus,
  type DemoStudent,
  type StudentOverride,
} from "@/data/demo";
import type { QuranicAssignment, HifzPortion, DailyRating } from "@/hooks/useQuranicAssignments";
import { readDemoStore } from "@/lib/demoStore";
import { createClient } from "@/lib/supabase/client";

export type PortalMode = "loading" | "demo" | "real";

/**
 * Whose students a portal should show is already decided by row-level
 * security: a parent's session sees only their own children, a teacher's
 * sees their school, a student's sees themselves. So this asks for the same
 * roster in all three portals and lets the database narrow it, rather than
 * each portal carrying its own idea of scope that could drift from the
 * policy that actually enforces it.
 */
export function usePortalRoster(demoFallback: DemoStudent[] = DEMO_CHILDREN) {
  const [mode, setMode] = useState<PortalMode>("loading");
  const [students, setStudents] = useState<DemoStudent[]>([]);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStudents(demoFallback);
        setMode("demo");
        return;
      }

      const { data } = await supabase
        .from("students")
        .select("id, full_name, active")
        .eq("active", true)
        .order("full_name");
      setStudents((data ?? []).map((s) => ({ id: s.id, name: s.full_name, halaqa: "" })));
      setMode("real");
    };

    load().catch(() => {
      setStudents(demoFallback);
      setMode("demo");
    });
    // The fallback is a module constant at every call site; re-running on a
    // fresh array identity would reload the roster on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { mode, students };
}

/** The whole roster rather than just this user's slice — for the admin and
 *  teacher views that list every child in the school. */
export function useSchoolRoster() {
  return usePortalRoster(DEMO_STUDENTS);
}

export interface StudentRecord {
  attendance: AttendanceDay[];
  assignments: QuranicAssignment[];
  ready: boolean;
}

/**
 * One child's register and Qur'an work. In demo mode this is the sample
 * data plus whatever a teacher has created in the browser this session;
 * against a real school it's their own rows, again scoped by RLS rather
 * than by a filter written here.
 */
export function useStudentRecord(studentId: string | null, mode: PortalMode): StudentRecord {
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);
  const [assignments, setAssignments] = useState<QuranicAssignment[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (mode === "loading" || !studentId) return;
    setReady(false);

    if (mode === "demo") {
      setAttendance(DEMO_ATTENDANCE[studentId] ?? []);
      setAssignments(
        demoAssignmentsFor(studentId, readDemoStore(DEMO_CREATED_ASSIGNMENTS_KEY, []))
      );
      setReady(true);
      return;
    }

    const supabase = createClient();
    const load = async () => {
      const [{ data: attendanceRows }, { data: assignmentRows }] = await Promise.all([
        supabase
          .from("attendance")
          .select("class_date, status")
          .eq("student_id", studentId)
          .order("class_date", { ascending: false })
          .limit(20),
        supabase
          .from("quranic_assignments")
          .select("*")
          .eq("student_id", studentId)
          .order("assigned_at", { ascending: false }),
      ]);

      setAttendance(
        (attendanceRows ?? []).map((a) => ({
          date: a.class_date,
          status: a.status as AttendanceStatus,
        }))
      );
      setAssignments(
        (assignmentRows ?? []).map((a) => ({
          id: a.id,
          student_id: a.student_id,
          teacher_id: a.teacher_id,
          surah: a.surah,
          ayah_start: a.ayah_start,
          surah_end: a.surah_end ?? a.surah,
          ayah_end: a.ayah_end,
          portion: (a.portion ?? "new") as HifzPortion,
          assigned_at: a.assigned_at,
          due_date: a.due_date,
          status: a.status,
          memorization_level: a.memorization_level ?? 0,
          daily_rating: (a.daily_rating ?? null) as DailyRating | null,
          teacher_notes: a.teacher_notes,
          student_notes: a.student_notes,
          created_at: a.created_at,
          updated_at: a.updated_at,
        }))
      );
    };

    load().finally(() => setReady(true));
  }, [studentId, mode]);

  return { attendance, assignments, ready };
}

/** The demo roster merged with anything the admin portal added locally —
 *  used as the demo-mode fallback where the full school list is wanted. */
export function demoSchoolRoster(): DemoStudent[] {
  return allStudents(
    readDemoStore(DEMO_CREATED_STUDENTS_KEY, []),
    readDemoStore<Record<string, StudentOverride>>(DEMO_STUDENT_OVERRIDES_KEY, {})
  );
}
