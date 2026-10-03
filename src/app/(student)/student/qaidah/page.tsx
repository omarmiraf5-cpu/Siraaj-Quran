"use client";

import { useEffect, useState } from "react";
import { DEMO_CURRENT_STUDENT } from "@/data/demo";
import { qaidahBook } from "@/data/qaidah";
import { usePortalRoster } from "@/hooks/usePortalRoster";
import { useQaidahLessons } from "@/hooks/useQaidahLessons";
import { currentLessons, passedLessons } from "@/lib/qaidahLessons";
import { useQaidahRecordings } from "@/hooks/useQaidahRecordings";
import {
  QaidahBookTabs,
  QaidahLessons,
  QaidahSummary,
  useQaidahBookChoice,
} from "@/components/QaidahBook";
import { MyQaidahLesson } from "@/components/QaidahLessonCard";

export default function StudentQaidahPage() {
  // A signed-in child's roster is just themselves; the sample portal's is
  // the sample child.
  const { mode, students } = usePortalRoster([DEMO_CURRENT_STUDENT]);
  const me = students[0] ?? null;
  const { rows, ready } = useQaidahLessons(mode, me ? [me.id] : []);
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
      <header className="gradient-navy rounded-[22px] px-6 py-6 relative overflow-hidden animate-rise">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Learning to read</p>
          <h1 className="page-title text-white text-[30px] mt-1 leading-tight">Qa&apos;idah</h1>
          <p
            className="font-calligraphy text-[26px] text-brand-gold-light mt-1.5 leading-tight"
            dir="rtl"
            lang="ar"
          >
            {book.arabicName}
          </p>
          <p className="text-[13px] text-white/55 mt-2.5">
            {book.lessons.length} lessons
            <span className="text-white/25 mx-2">·</span>
            {book.name}
          </p>
        </div>
      </header>

      {mine && <MyQaidahLesson row={mine} onOpen={openMine} />}

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
