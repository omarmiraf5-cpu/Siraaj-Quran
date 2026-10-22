"use client";

import { useEffect, useState } from "react";
import { DEMO_ATTENDANCE, demoAssignmentsFor, type AttendanceDay } from "@/data/demo";
import { Modal, LoadingNote } from "@/components/portal-ui";
import { StudentDetailPanel } from "@/components/StudentDetailPanel";
import { createClient } from "@/lib/supabase/client";
import { sessionUser } from "@/lib/supabase/sessionUser";
import { daysAgoIso } from "@/lib/supabase/fetchAll";
import { initials } from "@/data/demo";
import { useLanguage } from "@/components/LanguageProvider";
import type { QuranicAssignment } from "@/hooks/useQuranicAssignments";

/**
 * One student's record, opened from the office's lists: how often they come
 * and their Qur'an work, read for just them when it's opened. The same
 * panel a teacher gets from their home page, without the teacher's
 * shortcuts.
 */
export function StudentRecord({
  studentId,
  name,
  halaqa,
  onClose,
}: {
  studentId: string;
  name: string;
  halaqa: string;
  onClose: () => void;
}) {
  const { tr } = useLanguage();
  const [data, setData] = useState<{ attendance: AttendanceDay[]; assignments: QuranicAssignment[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const user = await sessionUser(supabase);
      // The sample school: its own data, in the browser.
      if (!user) {
        if (live) setData({ attendance: DEMO_ATTENDANCE[studentId] ?? [], assignments: demoAssignmentsFor(studentId, []) });
        return;
      }
      const [marks, work] = await Promise.all([
        supabase
          .from("attendance")
          .select("class_date, status")
          .eq("student_id", studentId)
          .gte("class_date", daysAgoIso(120))
          .order("class_date", { ascending: false })
          .limit(400),
        supabase.from("quranic_assignments").select("*").eq("student_id", studentId).order("assigned_at", { ascending: false }).limit(60),
      ]);
      if (!live) return;
      if (marks.error || work.error) {
        setFailed(true);
        return;
      }
      setData({
        attendance: (marks.data ?? []).map((m) => ({ date: m.class_date as string, status: m.status as AttendanceDay["status"] })),
        assignments: (work.data ?? []) as QuranicAssignment[],
      });
    })().catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [studentId]);

  if (!data) {
    return (
      <Modal title={name} subtitle={halaqa} badge={initials(name)} onClose={onClose}>
        {failed ? <p className="text-[13px] text-ink-muted">{tr("Couldn't load this record. Try again.")}</p> : <LoadingNote>{tr("Opening the record…")}</LoadingNote>}
      </Modal>
    );
  }
  return (
    <StudentDetailPanel
      studentId={studentId}
      onClose={onClose}
      readOnly
      real={{ student: { id: studentId, name, halaqa }, attendance: data.attendance, assignments: data.assignments }}
    />
  );
}
