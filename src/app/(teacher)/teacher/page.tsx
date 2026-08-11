"use client";

import { useDemoUser } from "@/hooks/useDemoUser";

const CLASSES = [
  { id: "1", grade: "Grade 4", name: "English Language Arts 4", time: "8:00 AM", room: "Room 3" },
  { id: "2", grade: "Grade 7", name: "Mathematics 7", time: "10:00 AM", room: "Room 1" },
  { id: "3", grade: "Grade 9", name: "Science 9", time: "1:00 PM", room: "Lab A" },
];

export default function TeacherClasses() {
  const demoUser = useDemoUser();
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="gradient-navy rounded-card-lg px-6 py-5 mb-6">
        <p className="text-white/55 text-sm font-medium">{greeting},</p>
        <h1 className="text-white text-xl font-bold mt-0.5">{demoUser?.name ?? "Teacher"}</h1>
      </div>

      <div className="space-y-3 mb-8">
        {CLASSES.map((cls) => (
          <div key={cls.id} className="bg-surface-card rounded-card-lg shadow-card border border-surface-border p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl gradient-navy flex items-center justify-center text-white font-bold text-xs flex-shrink-0 text-center leading-tight">
                {cls.grade.replace("Grade ", "Gr\n")}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink">{cls.name}</p>
                <p className="text-xs text-ink-muted mt-0.5">{cls.time} · {cls.room}</p>
                <div className="flex gap-2 mt-3">
                  <a href="/teacher/attendance" className="text-xs font-semibold px-3 py-1.5 rounded-pill bg-surface-bg border border-surface-border text-ink-body hover:border-brand-navy hover:text-brand-navy transition">
                    Attendance
                  </a>
                  <a href="/teacher/grades" className="text-xs font-semibold px-3 py-1.5 rounded-pill bg-surface-bg border border-surface-border text-ink-body hover:border-brand-navy hover:text-brand-navy transition">
                    Grades
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-ink mb-3">Create</h2>
      <div className="grid grid-cols-2 gap-3 max-w-sm">
        <a href="/teacher/lessons" className="bg-surface-card rounded-card-lg shadow-card border border-surface-border p-5 hover:border-brand-navy hover:-translate-y-0.5 transition-all">
          <div className="w-10 h-10 rounded-xl bg-brand-navy/10 text-brand-navy flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          </div>
          <p className="font-semibold text-ink text-sm">New Lesson</p>
          <p className="text-xs text-ink-muted mt-0.5">Upload video + notes</p>
        </a>
        <div className="bg-surface-card rounded-card-lg shadow-card border border-surface-border p-5 hover:border-brand-navy hover:-translate-y-0.5 transition-all cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </div>
          <p className="font-semibold text-ink text-sm">New Assignment</p>
          <p className="text-xs text-ink-muted mt-0.5">Set task + due date</p>
        </div>
      </div>
    </div>
  );
}
