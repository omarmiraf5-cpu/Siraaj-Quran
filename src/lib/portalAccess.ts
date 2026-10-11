// Which accounts each portal is for. A student's login opens the student
// pages and nothing else; a parent's, the parent pages; a teacher's, the
// teacher pages; and an admin's, the office — and the teacher pages too,
// for an admin who teaches a halaqa. The database already keeps each
// account to its own records; this keeps each one out of the others'
// screens as well.

export type Role = "admin" | "teacher" | "parent" | "student";
export const PORTALS = ["admin", "teacher", "parent", "student"] as const;
export type Portal = (typeof PORTALS)[number];

const ALLOWED: Record<Portal, Role[]> = {
  admin: ["admin"],
  teacher: ["teacher", "admin"],
  parent: ["parent"],
  student: ["student"],
};

/** The portal a path is in — "/teacher/attendance" is the teacher's — or null for shared pages. */
export function portalOf(path: string): Portal | null {
  const first = path.split(/[?#]/)[0].split("/")[1] ?? "";
  return (PORTALS as readonly string[]).includes(first) ? (first as Portal) : null;
}

/** Whether an account with this role may open this path. Shared pages (account, help…) are open to all. */
export function mayOpen(path: string, role: string | null | undefined): boolean {
  const portal = portalOf(path);
  if (!portal) return true;
  return !!role && (ALLOWED[portal] as string[]).includes(role);
}

/** An account's own home page. */
export const homeOf = (role: string | null | undefined) =>
  role && (PORTALS as readonly string[]).includes(role) ? `/${role}` : "/login";
