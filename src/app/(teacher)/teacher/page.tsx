"use client";

import Link from "next/link";
import { useDemoUser } from "@/hooks/useDemoUser";
import {
  DEMO_STUDENTS,
  DEMO_ASSIGNMENTS,
  DEMO_ATTENDANCE,
  summariseAttendance,
} from "@/data/demo";

const IconBook = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
  </svg>
);

const IconRegister = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4" />
  </svg>
);

const IconPen = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

const IconArrow = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function TeacherDashboard() {
  const demoUser = useDemoUser();

  const active = DEMO_ASSIGNMENTS.filter((a) => a.status !== "completed").length;
  const review = DEMO_ASSIGNMENTS.filter((a) => a.status === "needs_review").length;
  const avgAttendance = Math.round(
    DEMO_STUDENTS.reduce(
      (sum, s) => sum + summariseAttendance(DEMO_ATTENDANCE[s.id]).rate,
      0
    ) / DEMO_STUDENTS.length
  );

  const stats = [
    { label: "Students", value: DEMO_STUDENTS.length },
    { label: "Active work", value: active },
    { label: "Needs review", value: review },
    { label: "Attendance", value: `${avgAttendance}%` },
  ];

  const cards = [
    {
      href: "/teacher/quran-assignments",
      icon: IconPen,
      title: "Assignments",
      body: "Set a surah and ayah range for a student, with a due date and a note.",
    },
    {
      href: "/teacher/attendance",
      icon: IconRegister,
      title: "Attendance",
      body: "Take today's register and see how each student is tracking this term.",
    },
    {
      href: "/teacher/mushaf",
      icon: IconBook,
      title: "Mushaf",
      body: "Read the Madinah Mushaf, and play any ayah, page or surah aloud.",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pt-2">
      {/* Greeting */}
      <header className="gradient-navy rounded-[20px] px-7 py-7 relative overflow-hidden">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="relative">
          <p className="eyebrow text-white/45">Asalaamu alaykum</p>
          <h1 className="page-title text-white text-3xl mt-1.5">
            {demoUser?.name ?? "Teacher"}
          </h1>
          <div className="gold-rule w-24 mt-4 opacity-80" />
        </div>
      </header>

      {/* At a glance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="card-quiet px-4 py-4">
            <p className="text-2xl font-bold text-ink tabular-nums leading-none">{s.value}</p>
            <p className="eyebrow mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="grid md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card-quiet card-feature p-5 group transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="icon-tile mb-4">{c.icon}</span>
            <h2 className="page-title text-lg mb-1.5">{c.title}</h2>
            <p className="text-[13px] text-ink-muted leading-relaxed">{c.body}</p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted group-hover:text-ink transition-colors">
              Open
              <span className="group-hover:translate-x-0.5 transition-transform">{IconArrow}</span>
            </span>
          </Link>
        ))}
      </div>

      {/* Hadith — a quiet feature panel rather than a green alert box */}
      <section className="card-quiet px-6 py-8 text-center">
        <p className="eyebrow">Daily reflection</p>
        <p
          className="font-calligraphy text-[28px] md:text-[34px] text-ink mt-4 leading-[2.1]"
          dir="rtl"
          lang="ar"
        >
          خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
        </p>
        <div className="gold-rule w-20 mx-auto my-5" />
        <p className="font-serif text-[15px] text-ink-body italic">
          &ldquo;The best among you are those who learn the Qur&apos;an and teach it.&rdquo;
        </p>
        <p className="text-[11px] text-ink-muted mt-2">Prophet Muhammad &#xFDFA;</p>
      </section>
    </div>
  );
}
