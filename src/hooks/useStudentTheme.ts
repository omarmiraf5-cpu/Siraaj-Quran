"use client";

import { useEffect, useState } from "react";

export type StudentGender = "boy" | "girl";

export interface StudentTheme {
  gender: StudentGender;
  /** Page background */
  bg: string;
  /** Hero card gradient */
  hero: string;
  /** Accent text colour for labels and active states */
  accent: string;
  /** Accent gradient for small tiles and buttons */
  accentTile: string;
}

const THEMES: Record<StudentGender, StudentTheme> = {
  boy: {
    gender: "boy",
    bg: "bg-[#f2f6fb] dark:bg-[#0d1117]",
    hero: "student-hero-boy",
    accent: "text-subject-blue",
    accentTile: "student-gradient-blue",
  },
  girl: {
    gender: "girl",
    bg: "bg-[#fdf5f8] dark:bg-[#14101a]",
    hero: "student-hero-girl",
    accent: "text-subject-purple",
    accentTile: "student-gradient-purple",
  },
};

// Demo-only heuristic. Real enrolment should store this on the student record.
const GIRL_NAMES = ["halima", "fatima", "aisha", "khadija", "maryam", "farah", "amina", "hodan", "sagal"];

export function useStudentTheme(): StudentTheme {
  const [gender, setGender] = useState<StudentGender>("boy");

  useEffect(() => {
    try {
      const pref = localStorage.getItem("student_gender");
      if (pref === "boy" || pref === "girl") {
        setGender(pref);
        return;
      }
      const stored = localStorage.getItem("demo_user");
      if (stored) {
        const name = String(JSON.parse(stored).name ?? "").toLowerCase();
        setGender(GIRL_NAMES.some((n) => name.includes(n)) ? "girl" : "boy");
      }
    } catch {
      setGender("boy");
    }
  }, []);

  return THEMES[gender];
}
