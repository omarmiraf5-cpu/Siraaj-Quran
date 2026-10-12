// A student signs in with a PIN, but Supabase Auth only speaks email and
// password — so each student account gets a derived address nobody ever
// receives mail at. Its password is random and known to no one: the PIN is
// checked by this app's server, which counts wrong guesses and rests a
// child's PIN pad after a few (lib/studentAuthServer, api/student-signin).

export const STUDENT_EMAIL_DOMAIN = "students.mydiiwaan.app";

export function studentLoginEmail(studentId: string): string {
  return `student-${studentId}@${STUDENT_EMAIL_DOMAIN}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
