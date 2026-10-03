"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_QAIDAH_BOOK,
  QAIDAH_BOOKS,
  isQaidahBookId,
  lessonTiles,
  type Ayah,
  type QaidahBook,
  type QaidahBookId,
  type QaidahLesson,
} from "@/data/qaidah";
import type { QaidahStatus } from "@/lib/qaidahLessons";
import { recordingKey, type QaidahRecording } from "@/lib/qaidahRecordings";
import type { Reciter } from "@/lib/recitation";
import { ILLUM_CLASS, GRAD_CLASS, surahColour } from "@/components/student-ui";
import { IconArrow, IconCheck, IconSpeaker } from "@/components/icons";
import { useLanguage } from "@/components/LanguageProvider";
import {
  AyahButton,
  RecitationBar,
  TileListenBar,
  ayahTrackId,
  playTracks,
  stopPlayback,
  stopPlaybackIn,
  tileTrack,
  tileTrackId,
  usePlayback,
  useQaidahReciter,
} from "@/components/QaidahPlayer";
import { LessonListen, LessonRecorder, TileRecorder, type TileStatus } from "@/components/QaidahRecorder";

// The Qa'idah is read, not skimmed: the Arabic is the content, so it is set
// large enough to read across a table and each lesson opens on its own rather
// than the whole primer unrolling down the page.

/** Harakat, the Qur'anic signs above and below letters, and the joining stroke. */
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

/** Letters (and spaces) without their marks: اَبَّ is five characters but two letters. */
function letterCount(item: string) {
  return item.replace(MARKS, "").length;
}

/**
 * A letter or two (بَ, اَبْ, لا) fits a uniform square, so a row of them lines
 * up; anything longer, like قلم with no marks at all, keeps its natural width.
 */
function isShort(item: string) {
  return !/\s/.test(item) && letterCount(item) <= 2;
}

/** A run of Arabic, with the spaces between its words. */
const ARABIC_RUN =
  /([\u0600-\u06FF\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+(?:\s+[\u0600-\u06FF\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+)*)/;

/**
 * An explanation in English with Arabic in it. Each Arabic run is set in the
 * Qur'anic face, which has the standing harakat the interface face lacks, and
 * isolated so the punctuation around it keeps the English order: left to the
 * browser, "ح and ه, ع and ء" comes out as "ح and ع ,ه and ء".
 */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(ARABIC_RUN).map((part, i) =>
        i % 2 === 1 ? (
          <bdi key={i} lang="ar" className="font-arabic text-[1.25em] leading-none">
            {part}
          </bdi>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * While a run plays (a surah, a lesson's tiles), what's playing stays in
 * view: clear of the header, and of the menu bar along the bottom of a phone.
 */
function keepInView(el: HTMLElement | null) {
  if (!el) return;
  const { top, bottom } = el.getBoundingClientRect();
  if (top < 96 || bottom > window.innerHeight - 112) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** A teacher recording a lesson's tiles one by one: the one chosen, and how each is saving. */
interface Picking {
  selected: string;
  status: (item: string) => TileStatus | undefined;
  onPick: (item: string) => void;
}

/**
 * One tile of a row: a letter, a syllable, a word. With the teacher's
 * recording of it, tapping it plays it; while a teacher records the lesson
 * one by one, tapping it chooses it.
 */
function Tile({
  item,
  lessonKey,
  recording,
  picking,
}: {
  item: string;
  lessonKey: string;
  recording?: QaidahRecording;
  picking?: Picking;
}) {
  const { t } = useLanguage();
  const now = usePlayback();
  const playing = now.lesson === lessonKey && now.track === tileTrackId(item);
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (playing && now.group) keepInView(ref.current);
  }, [playing, now.group]);

  const selected = picking?.selected === item;
  const status = picking?.status(item);
  const size = isShort(item)
    ? "w-[46px] h-[52px] text-[27px]"
    : `min-h-[52px] px-3 py-1.5 ${letterCount(item) > 24 ? "text-[19px]" : "text-[23px]"}`;
  const look = playing
    ? "bg-brand-gold/15 border-brand-gold ring-2 ring-brand-gold/40"
    : status === "failed"
      ? "bg-surface-card border-red-500 ring-2 ring-red-500/30"
      : selected
        ? "bg-surface-card border-brand-navy ring-2 ring-brand-navy/40"
        : "bg-surface-card border-surface-border";
  const className = `relative font-arabic text-ink rounded-xl border flex items-center justify-center ${size} leading-[1.9] ${look} ${
    status === "saving" ? "animate-pulse" : ""
  }`;
  // A dot in the corner: the teacher has recorded this one.
  const recordedDot = recording ? (
    <span aria-hidden className="absolute top-1 end-1 w-1.5 h-1.5 rounded-full bg-brand-gold" />
  ) : null;

  if (picking) {
    return (
      <button
        ref={(el) => {
          ref.current = el;
        }}
        type="button"
        aria-pressed={selected}
        onClick={() => picking.onPick(item)}
        className={`${className} hover:border-brand-gold/70`}
      >
        {item}
        {recordedDot}
      </button>
    );
  }
  if (recording) {
    return (
      <button
        ref={(el) => {
          ref.current = el;
        }}
        type="button"
        title={t("qaidah.listenTile")}
        aria-pressed={playing}
        onClick={() => (playing ? stopPlayback() : playTracks(lessonKey, [tileTrack(recording)]))}
        className={`${className} hover:border-brand-gold/70`}
      >
        {item}
        {recordedDot}
      </button>
    );
  }
  return (
    <span
      ref={(el) => {
        ref.current = el;
      }}
      className={className}
    >
      {item}
    </span>
  );
}

/**
 * A row of the lesson to read aloud, right to left. An ayah's row has a
 * button to hear it recited, and lights up while it's being recited.
 */
function LessonRow({
  items,
  lessonKey,
  ayah,
  reciter,
  recordingOf,
  picking,
}: {
  items: string[];
  lessonKey: string;
  ayah?: Ayah;
  reciter: Reciter;
  /** The teacher's recording of a tile, where there is one. */
  recordingOf: (item: string) => QaidahRecording | undefined;
  picking?: Picking;
}) {
  const now = usePlayback();
  const reciting = !!ayah && now.lesson === lessonKey && now.track === ayahTrackId(ayah);
  const row = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (reciting && now.group) keepInView(row.current);
  }, [reciting, now.group]);

  return (
    <div
      ref={row}
      dir="rtl"
      lang="ar"
      className={`flex items-center gap-2 rounded-2xl border p-2.5 transition-colors ${
        reciting ? "bg-brand-gold/10 border-brand-gold ring-2 ring-brand-gold/30" : "bg-surface-bg-warm border-surface-border"
      }`}
    >
      {ayah && <AyahButton lesson={lessonKey} ayah={ayah} reciter={reciter} />}
      <div className="flex-1 min-w-0 flex flex-wrap gap-1.5 justify-center">
        {items.map((item, c) => (
          <Tile key={c} item={item} lessonKey={lessonKey} recording={recordingOf(item)} picking={picking} />
        ))}
      </div>
    </div>
  );
}

/** What a teacher can do with the lessons' recordings. */
export interface LessonRecorderControls {
  demo: boolean;
  /** The school's database can't take recordings yet. */
  unavailable: boolean;
  onSaved: (recording: QaidahRecording) => void;
  onDeleted: (book: QaidahBookId, lesson: number, item?: string) => void;
}

/**
 * An open lesson: what it teaches, the teacher's recording of it (or the
 * recorder, for a teacher), the reciter where it's a surah, and its rows.
 * Recording it one by one lasts while it's open.
 */
function LessonBody({
  book,
  lesson,
  colour,
  recordings,
  recorder,
  reciter,
  onReciterChange,
}: {
  book: QaidahBook;
  lesson: QaidahLesson;
  colour: ReturnType<typeof surahColour>;
  recordings: Map<string, QaidahRecording>;
  recorder?: LessonRecorderControls;
  reciter: Reciter;
  onReciterChange: (id: string) => void;
}) {
  const { t } = useLanguage();
  const lessonKey = `${book.id}:${lesson.id}`;
  const tiles = useMemo(() => lessonTiles(lesson), [lesson]);
  // Recording the tiles one by one: the tile chosen, or null when not.
  const [oneByOne, setOneByOne] = useState<string | null>(null);
  const [tileStatus, setTileStatus] = useState<Record<string, TileStatus>>({});

  // Closing the lesson, or leaving the page, stops whatever of it is playing.
  useEffect(() => () => stopPlaybackIn(lessonKey), [lessonKey]);

  const recordingOf = (item: string) => recordings.get(recordingKey(book.id, lesson.id, item));
  const whole = recordings.get(recordingKey(book.id, lesson.id));
  const tileRecordings = tiles.flatMap((item) => recordingOf(item) ?? []);
  const picking: Picking | undefined =
    recorder && oneByOne !== null
      ? {
          selected: oneByOne,
          status: (item) => tileStatus[recordingKey(book.id, lesson.id, item)],
          onPick: setOneByOne,
        }
      : undefined;
  const setStatus = (item: string, status: TileStatus | null) =>
    setTileStatus((prev) => {
      const next = { ...prev };
      const key = recordingKey(book.id, lesson.id, item);
      if (status) next[key] = status;
      else delete next[key];
      return next;
    });

  return (
    <div className="px-4 pb-5">
      <div className="gold-rule mb-4" />

      {/* The explanations are English whatever the interface
          language, so they keep left-to-right under Arabic too. */}
      <p dir="ltr" className="text-[13px] text-ink-body leading-relaxed">
        <Prose text={lesson.teaches} />
      </p>

      {recorder ? (
        oneByOne !== null ? (
          <TileRecorder
            book={book.id}
            lesson={lesson.id}
            lessonKey={lessonKey}
            tiles={tiles}
            recordings={recordings}
            demo={recorder.demo}
            selected={oneByOne}
            onSelect={setOneByOne}
            status={tileStatus}
            onStatus={setStatus}
            onSaved={recorder.onSaved}
            onDeleted={(item) => recorder.onDeleted(book.id, lesson.id, item)}
            onDone={() => setOneByOne(null)}
          />
        ) : (
          <LessonRecorder
            book={book.id}
            lesson={lesson.id}
            recording={whole}
            demo={recorder.demo}
            unavailable={recorder.unavailable}
            onSaved={recorder.onSaved}
            onDeleted={() => recorder.onDeleted(book.id, lesson.id)}
            oneByOne={
              recorder.unavailable || tiles.length === 0
                ? undefined
                : {
                    recorded: tileRecordings.length,
                    total: tiles.length,
                    // Starting where there's still something to record.
                    onStart: () => setOneByOne(tiles.find((item) => !recordingOf(item)) ?? tiles[0]),
                  }
            }
          />
        )
      ) : whole ? (
        <LessonListen recording={whole} label={t("qaidah.listen")} />
      ) : null}

      {/* Where the reading isn't what's printed — a letter that is
          skipped, a word stopped on — each word as printed, with
          how it's read underneath. */}
      {lesson.readings && (
        <div className="mt-4 space-y-2.5">
          {lesson.readings.map((group, g) => (
            <div key={g} className="rounded-2xl bg-surface-bg-warm border border-surface-border p-2.5">
              {group.label && (
                <p dir="ltr" className="text-[11.5px] font-semibold text-ink-muted text-center mb-2">
                  {group.label}
                </p>
              )}
              <div dir="rtl" className="flex flex-wrap gap-1.5 justify-center">
                {group.words.map(([printed, read]) => (
                  <span
                    key={printed}
                    className="rounded-xl bg-surface-card border border-surface-border p-1.5 flex flex-col items-center gap-0.5"
                  >
                    <span lang="ar" className="font-arabic text-ink text-[23px] leading-[1.9] px-2">
                      {printed}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">read as</span>
                    <span
                      lang="ar"
                      className={`${ILLUM_CLASS.verdigris} !rounded-lg w-full font-arabic text-[21px] leading-[1.9] px-2.5`}
                    >
                      {read}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* The surahs the book ends on, recited. */}
      {lesson.ayahs && (
        <RecitationBar
          lesson={lessonKey}
          ayahs={Object.keys(lesson.ayahs)
            .map(Number)
            .sort((a, b) => a - b)
            .map((r) => lesson.ayahs![r])}
          reciter={reciter}
          onReciterChange={onReciterChange}
        />
      )}

      {/* The teacher's tiles, one by one: tap one, or hear them all. */}
      {tileRecordings.length > 0 && oneByOne === null && (
        <TileListenBar lesson={lessonKey} tracks={tileRecordings.map(tileTrack)} />
      )}

      {/* The rows themselves, right to left. */}
      <div className="mt-4 space-y-2.5">
        {lesson.rows.map((row, r) => (
          <Fragment key={r}>
            {lesson.rowLabels?.[r] && (
              <p dir="ltr" className="text-[11.5px] font-semibold text-ink-muted text-center pt-1.5">
                <Prose text={lesson.rowLabels[r]} />
              </p>
            )}
            <LessonRow
              items={row}
              lessonKey={lessonKey}
              ayah={lesson.ayahs?.[r]}
              reciter={reciter}
              recordingOf={recordingOf}
              picking={picking}
            />
          </Fragment>
        ))}
      </div>

      {lesson.note && (
        <div dir="ltr" className={`${ILLUM_CLASS[colour]} rounded-2xl px-4 py-3 mt-4 !block`}>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-1">For the teacher</p>
          <p className="text-[13px] leading-snug">
            <Prose text={lesson.note} />
          </p>
        </div>
      )}
    </div>
  );
}

const NO_RECORDINGS = new Map<string, QaidahRecording>();

/** One book's lessons, each opening on its own. */
export function QaidahLessons({
  book,
  open,
  onOpenChange,
  current,
  passed = [],
  counts,
  recordings = NO_RECORDINGS,
  recorder,
}: {
  book: QaidahBook;
  /** The open lesson, where the page decides it; otherwise the child's own, or the first. */
  open?: number | null;
  onOpenChange?: (lesson: number | null) => void;
  /** The child's own lesson in this book, marked out. */
  current?: { lesson: number; status: QaidahStatus };
  /** Lessons the child has passed in this book, ticked. */
  passed?: number[];
  /** How many of the teacher's students are on each lesson. */
  counts?: Record<number, number>;
  /** The school's recordings, of lessons and of their tiles: to play, and to mark the lessons that have them. */
  recordings?: Map<string, QaidahRecording>;
  /** A teacher's: recording a lesson, whole or a tile at a time. */
  recorder?: LessonRecorderControls;
}) {
  const { t } = useLanguage();
  const [ownOpen, setOwnOpen] = useState<number | null>(current?.lesson ?? 1);
  const openLesson = open !== undefined ? open : ownOpen;
  const setOpenLesson = onOpenChange ?? setOwnOpen;
  const [reciter, setReciter] = useQaidahReciter();

  // The lessons with something of the teacher's to hear, whole or a tile.
  const recordedLessons = useMemo(() => {
    const lessons = new Set<number>();
    for (const r of recordings.values()) if (r.book === book.id) lessons.add(r.lesson);
    return lessons;
  }, [recordings, book.id]);

  return (
    <div className="space-y-3">
      {book.lessons.map((lesson, i) => {
        const isOpen = openLesson === lesson.id;
        const isCurrent = current?.lesson === lesson.id;
        const isPassed = !isCurrent && passed.includes(lesson.id);
        const count = counts?.[lesson.id] ?? 0;
        const recorded = recordedLessons.has(lesson.id);
        // Reuses the surah hash so the lesson numbers spread across the
        // palette instead of cycling in a visible pattern.
        const colour = surahColour(lesson.id * 3 + 1);

        return (
          <article
            key={lesson.id}
            id={`qaidah-${book.id}-${lesson.id}`}
            className={`card-quiet overflow-hidden animate-rise scroll-mt-4 ${
              isCurrent ? "ring-2 ring-brand-gold/70" : ""
            }`}
            style={{ animationDelay: `${40 + i * 35}ms` }}
          >
            <button
              type="button"
              onClick={() => setOpenLesson(isOpen ? null : lesson.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-3.5 p-4 text-start hover:bg-surface-bg-warm transition-colors"
            >
              <span
                className={`${GRAD_CLASS[colour]} w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0 shadow-sm`}
              >
                {lesson.id}
              </span>

              {/* The lesson's aim lives in the body, not here — it was
                  printed in both places, so an open lesson said the same
                  sentence twice. */}
              <span className="flex-1 min-w-0">
                {/* Wraps rather than truncating: on a phone most of the
                    book's lesson names are longer than one line. */}
                <span className="block page-title text-[16px] leading-snug">{lesson.title}</span>
                <span
                  className="block font-arabic text-[15px] text-ink-muted mt-0.5 truncate"
                  dir="rtl"
                  lang="ar"
                >
                  {lesson.arabicTitle}
                </span>
                {(isCurrent || isPassed || count > 0 || recorded) && (
                  <span className="flex flex-wrap gap-1.5 mt-1.5">
                    {isCurrent && (
                      <span
                        className={`${
                          ILLUM_CLASS[current.status === "repeat" ? "vermilion" : "saffron"]
                        } !inline-flex !rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide`}
                      >
                        {current.status === "repeat"
                          ? t("qaidah.statusRepeat")
                          : current.status === "passed"
                            ? t("qaidah.statusPassed")
                            : t("qaidah.yourLesson")}
                      </span>
                    )}
                    {isPassed && (
                      <span
                        className={`${ILLUM_CLASS.verdigris} !inline-flex !rounded-full gap-1 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide`}
                      >
                        <IconCheck size={11} />
                        {t("qaidah.statusPassed")}
                      </span>
                    )}
                    {recorded && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface-bg-warm border border-brand-gold/50 px-2 py-0.5 text-[11px] font-semibold text-ink">
                        <IconSpeaker size={12} />
                        {t("qaidah.recorded")}
                      </span>
                    )}
                    {count > 0 && (
                      <span className="inline-flex rounded-full bg-surface-bg-warm border border-surface-border px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                        {count} {t("qaidah.onThisLesson")}
                      </span>
                    )}
                  </span>
                )}
              </span>

              <span
                className={`text-ink-muted flex-shrink-0 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                <IconArrow size={15} />
              </span>
            </button>

            {isOpen && (
              <LessonBody
                book={book}
                lesson={lesson}
                colour={colour}
                recordings={recordings}
                recorder={recorder}
                reciter={reciter}
                onReciterChange={setReciter}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}

/** What working through the book involves, shown above its lessons. */
export function QaidahSummary({ book }: { book: QaidahBook }) {
  return (
    <section className="card-quiet card-feature p-5">
      <div className="flex items-start gap-3.5">
        <span className={`${ILLUM_CLASS.verdigris} w-10 h-10 rounded-2xl flex-shrink-0`}>
          <IconCheck size={18} />
        </span>
        <div dir="ltr">
          <h2 className="page-title text-[16px]">How this works</h2>
          <p className="text-[13px] text-ink-body leading-relaxed mt-1">
            {book.summary} Work through the lessons in order — each one assumes the one
            before it. Read every row aloud.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Which book: the three side by side, each with its Arabic name. */
export function QaidahBookTabs({
  value,
  onChange,
}: {
  value: QaidahBookId;
  onChange: (book: QaidahBookId) => void;
}) {
  const { t } = useLanguage();
  return (
    <div role="tablist" aria-label={t("qaidah.book")} className="grid grid-cols-3 gap-2">
      {QAIDAH_BOOKS.map((b) => {
        const active = b.id === value;
        return (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(b.id)}
            className={`rounded-2xl border px-2.5 py-2.5 text-center transition-all ${
              active
                ? "bg-brand-navy border-brand-navy text-white shadow-sm"
                : "bg-surface-card border-surface-border text-ink hover:border-brand-gold/60"
            }`}
          >
            <span className="block text-[13px] font-semibold leading-tight">{b.name}</span>
            <span
              className={`block font-arabic text-[13px] leading-snug mt-0.5 ${
                active ? "text-brand-gold-light" : "text-ink-muted"
              }`}
              dir="rtl"
              lang="ar"
            >
              {b.arabicName}
            </span>
            <span className={`block text-[11px] mt-0.5 ${active ? "text-white/60" : "text-ink-muted"}`}>
              {b.lessons.length} {t("qaidah.lessonsCount")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const BOOK_KEY = "mydiiwaan_qaidah_book";

/**
 * The book on screen, remembered in this browser so a school that teaches
 * from one book opens on it. A child's own lesson can show its book without
 * changing what's remembered.
 */
export function useQaidahBookChoice(): [QaidahBookId, (book: QaidahBookId, remember?: boolean) => void] {
  const [book, setBook] = useState<QaidahBookId>(DEFAULT_QAIDAH_BOOK);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(BOOK_KEY);
      if (isQaidahBookId(stored)) setBook(stored);
    } catch {
      // No storage (private browsing): the default book it is.
    }
  }, []);
  const choose = useCallback((next: QaidahBookId, remember = true) => {
    setBook(next);
    if (!remember) return;
    try {
      localStorage.setItem(BOOK_KEY, next);
    } catch {
      // Still shown for this visit.
    }
  }, []);
  return [book, choose];
}
