"use client";

import { qaidahBook, qaidahLesson } from "@/data/qaidah";
import { formatDay } from "@/data/demo";
import { newestFirst, type QaidahAssignment } from "@/lib/qaidahLessons";
import { GRAD_CLASS, ILLUM_CLASS } from "@/components/student-ui";
import { SectionCard, TeacherNote } from "@/components/portal-ui";
import { IconArrow, IconBookOpen, IconCheck } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * A child's own Qa'idah lesson, as the teacher set it: on their home page
 * (a link to the Qa'idah) and at the top of the Qa'idah itself (a button
 * that opens the lesson).
 */
export function MyQaidahLesson({
  row,
  href,
  onOpen,
}: {
  row: QaidahAssignment;
  href?: string;
  onOpen?: () => void;
}) {
  const { t } = useLanguage();
  const book = qaidahBook(row.book);
  const lesson = qaidahLesson(row.book, row.lesson);
  const repeat = row.status === "repeat";
  const finished = row.status === "passed";
  const colour = repeat ? "vermilion" : finished ? "verdigris" : "saffron";
  const body = (
    <>
      <span className="pattern-lattice absolute inset-0 opacity-30 pointer-events-none" />
      <span className="relative w-14 h-14 rounded-2xl bg-white/20 border border-white/25 flex items-center justify-center text-white flex-shrink-0">
        {finished ? <IconCheck size={24} /> : <IconBookOpen size={24} />}
      </span>
      <span className="relative flex-1 min-w-0 text-start">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-white/75">
          {repeat ? t("qaidah.practiseAgain") : finished ? t("qaidah.finishedBook") : t("qaidah.yourLesson")}
        </span>
        <span className="block page-title text-white text-[17px] leading-snug mt-0.5">
          {t("qaidah.lesson")} {row.lesson}
          {lesson && <span className="text-white/80"> · {lesson.title}</span>}
        </span>
        <span className="block text-[12px] text-white/70 mt-0.5">{book.name}</span>
      </span>
      <span className="relative w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md text-ink flex-shrink-0 rtl:rotate-180">
        <IconArrow size={18} />
      </span>
    </>
  );
  const className = `${GRAD_CLASS[colour]} group relative overflow-hidden w-full flex items-center gap-4 p-4 rounded-[20px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[.98]`;
  return (
    <div className="space-y-2.5">
      {href ? (
        <a href={href} className={className}>
          {body}
        </a>
      ) : (
        <button type="button" onClick={onOpen} className={className}>
          {body}
        </button>
      )}
      {row.note && !finished && (
        <div className="card-quiet px-5 py-4">
          <TeacherNote>{row.note}</TeacherNote>
        </div>
      )}
    </div>
  );
}

/** A child's Qa'idah for their parent: the lesson they're on, and the last one passed. */
export function ChildQaidahCard({ rows, childName }: { rows: QaidahAssignment[]; childName: string }) {
  const { t, language } = useLanguage();
  const ordered = newestFirst(rows);
  const current = ordered[0];
  if (!current) return null;
  const lastPassed = ordered.find((r) => r.status === "passed" && r.id !== current.id);
  const book = qaidahBook(current.book);
  const lesson = qaidahLesson(current.book, current.lesson);
  const finished = current.status === "passed";
  const status = finished
    ? qaidahLesson(current.book, current.lesson + 1)
      ? t("qaidah.statusPassed")
      : t("qaidah.finishedBook")
    : current.status === "repeat"
      ? t("qaidah.statusRepeat")
      : t("qaidah.statusAssigned");
  const colour = finished ? "verdigris" : current.status === "repeat" ? "vermilion" : "saffron";

  return (
    <SectionCard title={t("nav.qaidah")} note={childName}>
      <div className="flex items-start gap-3.5">
        <span className={`${ILLUM_CLASS[colour]} w-11 h-11 rounded-2xl flex-shrink-0`}>
          {finished ? <IconCheck size={19} /> : <IconBookOpen size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{book.name}</p>
          <p className="page-title text-[16px] leading-snug mt-0.5">
            {t("qaidah.lesson")} {current.lesson}
            {lesson && <span className="text-ink-muted font-normal"> · {lesson.title}</span>}
          </p>
          <p className="text-[12px] text-ink-muted mt-1">
            <span
              className={`${ILLUM_CLASS[colour]} !inline-flex !rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide me-2`}
            >
              {status}
            </span>
            {finished && current.passed_at
              ? `${t("qaidah.passedOn")} ${formatDay(current.passed_at.slice(0, 10), language)}`
              : `${t("qaidah.since")} ${formatDay(current.assigned_at.slice(0, 10), language)}`}
          </p>
          {current.note && !finished && <TeacherNote>{current.note}</TeacherNote>}
          {lastPassed && (
            <p className="text-[12px] text-ink-muted mt-3 pt-3 border-t border-surface-border">
              {t("qaidah.lastPassed")}: {qaidahBook(lastPassed.book).shortName} · {t("qaidah.lesson")}{" "}
              {lastPassed.lesson}
              {lastPassed.passed_at && ` · ${formatDay(lastPassed.passed_at.slice(0, 10), language)}`}
            </p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
