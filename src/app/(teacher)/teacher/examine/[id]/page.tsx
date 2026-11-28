"use client";

import { use } from "react";
import { JuzTestScreen } from "@/components/juz-tests/JuzTestScreen";

export default function ExamineTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <JuzTestScreen id={id} role="teacher" backHref="/teacher/examine" />;
}
