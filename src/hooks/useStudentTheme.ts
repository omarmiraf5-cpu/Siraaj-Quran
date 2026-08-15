"use client";

import { useEffect, useState } from "react";
import { DEMO_CURRENT_STUDENT } from "@/data/demo";

export type StudentGender = "boy" | "girl";

export interface StudentTheme {
  gender: StudentGender;
  /** Hero card gradient */
  hero: string;
}

// The portal used to swap the whole page background too — a cold blue for
// boys, pink for girls — which meant a student's portal did not look like the
// same product as their teacher's or their parent's. The warm paper ground is
// now shared, and the colour comes from the illumination palette every child
// sees the same. What stays personal is only the hero gradient.
const THEMES: Record<StudentGender, StudentTheme> = {
  boy: { gender: "boy", hero: "student-hero-boy" },
  girl: { gender: "girl", hero: "student-hero-girl" },
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
