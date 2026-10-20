"use client";

import { useEffect, useState } from "react";
import { DEMO_CURRENT_STUDENT } from "@/data/demo";
import { qaidahBook } from "@/data/qaidah";
import { usePortalRoster } from "@/hooks/usePortalRoster";
import { useQaidahLessons } from "@/hooks/useQaidahLessons";
import { currentLessons, passedLessons } from "@/lib/qaidahLessons";
import { useQaidahRecordings } from "@/hooks/useQaidahRecordings";
import { StudentPageHeader } from "@/components/student-ui";
import {
  QaidahBookTabs,
  QaidahLessons,
  QaidahSummary,
  useQaidahBookChoice,
} from "@/components/QaidahBook";
import { MyQaidahLesson } from "@/components/QaidahLessonCard";
import { MyQaidahPages } from "@/components/MyQaidahPages";
import { useQaidahPages } from "@/hooks/useQaidahPages";
import { useLanguage } from "@/components/LanguageProvider";

export default function StudentQaidahPage() {
  const { tr } = useLanguage();
  // A signed-in child's roster is just themselves; the sample portal's is
  // the sample child.
  const { mode, students } = usePortalRoster([DEMO_CURRENT_STUDENT]);
  const me = students[0] ?? null;
  const { rows, ready } = useQaidahLessons(mode, me ? [me.id] : []);
  const pages = useQaidahPages(mode, me ? [me.id] : []);
  const mine = me ? (currentLessons(rows).get(me.id) ?? null) : null;

  const [bookId, setBookId] = useQaidahBookChoice();
  const [open, setOpen] = useState<number | null>(1);
  const book = qaidahBook(bookId);
  const audio = useQaidahRecordings(mode);

  // Once the child's lesson is known, open the Qa'idah on it.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready || settled) return;
    setSettled(true);
    if (mine) {
      setBookId(mine.book, false);
      setOpen(mine.lesson);
    }
  }, [ready, settled, mine, setBookId]);

  const openMine = () => {
    if (!mine) return;
    setBookId(mine.book, false);
    setOpen(mine.lesson);
    requestAnimationFrame(() =>
      document
        .getElementById(`qaidah-${mine.book}-${mine.lesson}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <StudentPageHeader
        emoji="📘"
        eyebrow={tr("Learning to read")}
        title={tr("Qa'idah")}
        arabic={book.arabicName}
        back={{ href: "/student/learn", label: tr("Learn") }}
        subtitle={<>{tr("{count} lessons", { count: book.lessons.length })} · {book.name}</>}
      />

      {mine && <MyQaidahLesson row={mine} onOpen={openMine} />}
      <MyQaidahPages rows={pages.rows} />

      <QaidahBookTabs value={bookId} onChange={setBookId} />
      <QaidahSummary book={book} />
      <QaidahLessons
        key={bookId}
        book={book}
        open={open}
        onOpenChange={setOpen}
        current={mine && mine.book === bookId ? { lesson: mine.lesson, status: mine.status } : undefined}
        passed={me ? passedLessons(rows, me.id, bookId) : []}
        recordings={audio.recordings}
      />
    </div>
  );
}
