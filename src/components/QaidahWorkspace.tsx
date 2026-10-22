"use client";

import { useMemo } from "react";
import { qaidahBook } from "@/data/qaidah";
import { currentLessons } from "@/lib/qaidahLessons";
import { useQaidahRecordings } from "@/hooks/useQaidahRecordings";
import {
  QaidahBookTabs,
  QaidahLessons,
  QaidahSummary,
  useQaidahBookChoice,
} from "@/components/QaidahBook";
import { QaidahAssignPanel, useQaidahClassroom } from "@/components/QaidahAssignPanel";
import { QaidahPagesPanel } from "@/components/QaidahPagesPanel";

/**
 * The teacher's Qa'idah: the book's lessons and each child's lesson, with
 * the panel to set them. A part of the Islamic & Arabic page.
 */
export function QaidahWorkspace() {
  const room = useQaidahClassroom();
  const [bookId, setBookId] = useQaidahBookChoice();
  const book = qaidahBook(bookId);
  const audio = useQaidahRecordings(room.mode);

  // How many children are on each lesson of the book on screen.
  const counts = useMemo(() => {
    const byLesson: Record<number, number> = {};
    for (const row of currentLessons(room.rows).values()) {
      if (row.book === bookId && row.status !== "passed") {
        byLesson[row.lesson] = (byLesson[row.lesson] ?? 0) + 1;
      }
    }
    return byLesson;
  }, [room.rows, bookId]);

  return (
    <div className="space-y-4">
      <QaidahBookTabs value={bookId} onChange={setBookId} />

      {/* Work set by pages of the book, beside the lesson-by-lesson panel below. */}
      <QaidahPagesPanel room={room} book={bookId} />

      {/* Side by side on a wide screen, the children's lessons beside the
          book; on a phone the children come first, since setting their
          lessons is what the teacher came to do. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="lg:order-2 lg:sticky lg:top-4">
          <QaidahAssignPanel room={room} book={bookId} />
        </div>
        <div className="space-y-4 lg:order-1 min-w-0">
          <QaidahSummary book={book} />
          <QaidahLessons
            key={bookId}
            book={book}
            counts={counts}
            recordings={audio.recordings}
            recorder={
              room.mode === "loading"
                ? undefined
                : {
                    demo: room.mode === "demo",
                    unavailable: audio.missingTable,
                    onSaved: audio.put,
                    onDeleted: audio.drop,
                  }
            }
          />
        </div>
      </div>
    </div>
  );
}
