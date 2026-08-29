export type Role = "teacher" | "parent" | "student" | "admin";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  active: boolean;
}

export interface Student {
  id: string;
  full_name: string;
  date_of_birth?: string;
  gender?: "male" | "female";
  avatar_initials: string;
  avatar_color: string;
  profile_id?: string;
  active: boolean;
}

export interface Teacher {
  id: string;
  full_name: string;
  email: string;
}
