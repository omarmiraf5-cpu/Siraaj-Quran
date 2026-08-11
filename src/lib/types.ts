export type Role = "admin" | "teacher" | "parent" | "student";

export interface School {
  id: string;
  name: string;
  slug: string;
  address?: string;
  city: string;
  province: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  timezone: string;
  school_year: string;
  max_students: number;
  plan: "starter" | "growth" | "premium";
  active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email?: string;
  phone?: string;
  school_id: string;
  avatar_url?: string;
  active: boolean;
}

export interface Student {
  id: string;
  full_name: string;
  grade: number;
  date_of_birth?: string;
  gender?: "male" | "female";
  avatar_initials: string;
  avatar_color: string;
  school_id: string;
  profile_id?: string;
  active: boolean;
}

export interface ParentStudent {
  parent_id: string;
  student_id: string;
  relation: "parent" | "guardian" | "other";
}

export interface Class {
  id: string;
  name: string;
  subject: string;
  grade: number;
  section?: string;
  teacher_id: string;
  school_id: string;
  school_year: string;
  active: boolean;
}

export interface ClassEnrollment {
  class_id: string;
  student_id: string;
  enrolled_at: string;
}

export interface Teacher {
  id: string;
  full_name: string;
  email: string;
}

export interface Lesson {
  id: string;
  title: string;
  subject: string;
  grade: number;
  week: number;
  day: number;
  content?: Record<string, unknown>;
  video_url?: string;
  notes?: string;
  class_id?: string;
  teacher_id: string;
  school_id: string;
  published_at?: string;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  instructions: string;
  due_date: string;
  grade: number;
  class_id?: string;
  teacher_id: string;
  school_id: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  status: "not_started" | "submitted" | "graded";
  grade_letter?: string;
  grade_percent?: number;
  submitted_at?: string;
  graded_at?: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id?: string;
  class_date: string;
  status: "present" | "late" | "absent";
  notes?: string;
  teacher_id: string;
  school_id: string;
}

export interface FeeRecord {
  id: string;
  student_id: string;
  school_id: string;
  term: number;
  description: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: "due" | "partial" | "paid";
}

export interface SubjectGrade {
  id: string;
  student_id: string;
  class_id?: string;
  subject: string;
  course_code: string;
  grade_percent: number;
  teacher_comment?: string;
  term: number;
  school_year: string;
  teacher_id?: string;
  school_id: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "all" | "teachers" | "parents" | "students";
  author_id: string;
  school_id: string;
  pinned: boolean;
  created_at: string;
}
