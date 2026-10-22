import { redirect } from "next/navigation";

// The Qa'idah is a part of the Islamic & Arabic page now.
export default function TeacherQaidahPage() {
  redirect("/teacher/class-work?tab=qaidah");
}
