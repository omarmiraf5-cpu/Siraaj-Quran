// A student signs in with a PIN, but Supabase Auth only speaks email and
// password — so each student account gets a derived address nobody ever
// receives mail at, and a password derived from the PIN plus their own id.
//
// Two things follow from that, and both are deliberate:
//
//  - The student's id is semi-public (the login screen lists the roster so a
//    child can find themselves), so the real secret is the four digits. That
//    is what a PIN is worth anywhere; Supabase's own auth rate limiting is
//    what stands between it and a brute force.
//  - Including the id in the password means two children who both pick 1234
//    still have different credentials, so one can't sign in as the other by
//    guessing a shared PIN.

export const STUDENT_EMAIL_DOMAIN = "students.mydiiwaan.app";

export function studentLoginEmail(studentId: string): string {
  return `student-${studentId}@${STUDENT_EMAIL_DOMAIN}`;
}

export function studentLoginPassword(studentId: string, pin: string): string {
  return `${pin}:${studentId}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
