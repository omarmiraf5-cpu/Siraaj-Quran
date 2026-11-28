"use client";

import { ExamineDay } from "@/components/juz-tests/ExamineDay";

export default function ExaminePage() {
  return <ExamineDay role="teacher" testHref={(id) => `/teacher/examine/${id}`} />;
}
