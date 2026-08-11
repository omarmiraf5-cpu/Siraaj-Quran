export const SUBJECTS = [
  { name: "English Language Arts", code: "ELA", color: "purple" as const },
  { name: "Mathematics", code: "MATH", color: "blue" as const },
  { name: "Science", code: "SCI", color: "teal" as const },
  { name: "Social Studies", code: "SS", color: "orange" as const },
  { name: "Physical Education & Wellness", code: "PE", color: "pink" as const },
  { name: "Arts", code: "ARTS", color: "purple" as const },
];

export const GRADES = [
  { label: "Kindergarten", value: 0, band: "Kindergarten" },
  ...Array.from({ length: 6 }, (_, i) => ({
    label: `Grade ${i + 1}`,
    value: i + 1,
    band: "Elementary",
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    label: `Grade ${i + 7}`,
    value: i + 7,
    band: "Junior-Senior High",
  })),
];

export const BANDS = [
  { label: "Kindergarten", grades: [0] },
  { label: "Elementary (Grades 1–6)", grades: [1, 2, 3, 4, 5, 6] },
  { label: "Junior-Senior High (Grades 7–10)", grades: [7, 8, 9, 10] },
];

export function getStreamedCourseCode(subject: string, grade: number): string {
  if (grade < 10) return subject;
  const codes: Record<string, string> = {
    "English Language Arts": "ELA 10-1 / 10-2",
    Mathematics: "Math 10C / 10-3",
    Science: "Science 10",
    "Social Studies": "Social 10-1 / 10-2",
  };
  return codes[subject] ?? subject;
}
