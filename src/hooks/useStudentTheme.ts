"use client";

import { useEffect, useState } from "react";
import { DEMO_CURRENT_STUDENT } from "@/data/demo";

export type StudentGender = "boy" | "girl";

export interface StudentTheme {
  gender: StudentGender;
  /** Hero card gradient */
  hero: string;
  /** Accent text colour for labels and active states */
  accent: string;
  /** Solid accent fill for small tiles and selected states */
  accentTile: string;
  /** Ring colour for the active tab */
  accentRing: string;
}

// The portal used to swap the whole page background too — a cold blue for
// boys, pink for girls — which meant a student's portal did not look like the
// same product as their teacher's or their parent's. The warm paper ground is
// now shared; only the accent is personal, and both are drawn from the brand
// rather than from the default Tailwind palette.
const THEMES: Record<StudentGender, StudentTheme> = {
  boy: {
    gender: "boy",
    hero: "student-hero-boy",
    accent: "text-[#1d4e6f] dark:text-[#7fc4e8]",
    accentTile: "bg-[#1d4e6f]",
    accentRing: "bg-[#1d4e6f]/10",
  },
  girl: {
    gender: "girl",
    hero: "student-hero-girl",
    accent: "text-[#6b2d5c] dark:text-[#e2a8d4]",
    accentTile: "bg-[#6b2d5c]",
    accentRing: "bg-[#6b2d5c]/10",
  },
};

// Demo-only heuristic. Real enrolment should store this on the student record.
const GIRL_NAMES = ["halima", "fatima", "fatuma", "aisha", "khadija", "maryam", "farah", "amina", "hodan", "sagal", "safia", "hawa"];

export function useStudentTheme(): StudentTheme {
  const [gender, setGender] = useState<StudentGender>("boy");

  useEffect(() => {
    try {
      const pref = localStorage.getItem("student_gender");
      if (pref === "boy" || pref === "girl") {
        setGender(pref);
        return;
      }
      // Falls back to the student the portal previews, so the theme matches
      // the name actually on screen rather than defaulting to boy for a page
      // headed "Amina".
      const stored = localStorage.getItem("demo_user");
      const name = String(
        (stored ? JSON.parse(stored).name : null) ?? DEMO_CURRENT_STUDENT.name
      ).toLowerCase();
      setGender(GIRL_NAMES.some((n) => name.includes(n)) ? "girl" : "boy");
    } catch {
      setGender("boy");
    }
  }, []);

  return THEMES[gender];
}
