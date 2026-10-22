import "server-only";

import { SURAHS, getSurahById } from "@/data/mushaf-index";
import { JUZ_STARTS } from "@/data/juz-index";
import { memorisation, milestones, type MemoLesson } from "@/lib/milestoneCore";
import { notify, type NewNotification } from "@/lib/attendanceServer";
import { createAdminClient } from "@/lib/supabase/admin";

const MAP = { ayahsInSurah: SURAHS.map((s) => s.ayahs), juzStarts: JUZ_STARTS };
// A milestone is announced when the lesson that reached it was just saved.
const JUST_NOW_MS = 10 * 60 * 1000;

/**
 * After a lesson is marked completed: tells the child's parents when it
 * finished a surah or a juz', or brought a juz' to nearly halfway. Each
 * milestone is announced once per parent (the dedupe key), however many
 * times the lesson is re-saved. Never throws: the lesson is already saved.
 */
export async function announceMilestones(studentId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: student } = await admin.from("students").select("id, full_name, school_id").eq("id", studentId).maybeSingle();
    if (!student) return;
    const { data: rows } = await admin
      .from("quranic_assignments")
      .select("surah, ayah_start, surah_end, ayah_end, updated_at")
      .eq("student_id", studentId)
      .eq("portion", "new")
      .eq("status", "completed");
    const fresh = milestones(memorisation((rows ?? []) as MemoLesson[], MAP)).filter(
      (m) => Date.now() - Date.parse(m.at) < JUST_NOW_MS
    );
    if (fresh.length === 0) return;

    const { data: links } = await admin.from("parent_students").select("parent_id").eq("student_id", studentId);
    const parents = ((links ?? []) as Array<{ parent_id: string }>).map((l) => l.parent_id);
    if (parents.length === 0) return;

    const name = String(student.full_name).trim().split(/\s+/)[0] || "Your child";
    const out: NewNotification[] = [];
    for (const m of fresh) {
      const [title, body, key] =
        m.kind === "surah"
          ? [`${name} finished Surah ${getSurahById(m.surah)?.englishName ?? m.surah}`, "Mashaa Allah! A whole surah memorised. A kind word from you will mean a lot today.", `ms:surah:${m.surah}`]
          : m.kind === "juz"
            ? [`${name} completed Juz' ${m.juz}`, "Mashaa Allah! A whole juz' memorised. Please make du'a for them and let them know how proud you are.", `ms:juz:${m.juz}`]
            : [`${name} is almost halfway through Juz' ${m.juz}`, "They're close to the halfway mark. A little encouragement now helps them keep going.", `ms:half:${m.juz}`];
      for (const parent of parents) {
        out.push({
          school_id: student.school_id as string,
          recipient_id: parent,
          student_id: studentId,
          kind: "milestone",
          title,
          body,
          dedupe_key: `${key}:${studentId}`,
        });
      }
    }
    await notify(admin as never, out);
  } catch (error) {
    console.error("Milestones: could not announce", error);
  }
}
