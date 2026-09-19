"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step =
  | "welcome"
  | "school"
  | "admin"
  | "teachers"
  | "students"
  | "parents"
  | "halaqas"
  | "review"
  | "complete";

// Parents sit after students because a parent is only meaningful once
// there's a child to attach them to — the step lists the students just
// entered and asks which ones belong to whom.
const STEPS: Step[] = ["welcome", "school", "admin", "teachers", "students", "parents", "halaqas", "review"];
const STEP_LABELS: Record<Step, string> = {
  welcome: "Welcome",
  school: "School",
  admin: "Admin",
  teachers: "Teachers",
  students: "Students",
  parents: "Parents",
  halaqas: "Halaqas",
  review: "Review",
  complete: "Done",
};

interface SchoolForm {
  name: string;
  city: string;
  province: string;
  timezone: string;
}
interface AdminForm {
  fullName: string;
  email: string;
  password: string;
}
interface Teacher {
  id: string;
  name: string;
  email: string;
  halaqa: string;
}
interface Student {
  id: string;
  name: string;
  age: string;
  halaqa: string;
}
interface Parent {
  id: string;
  name: string;
  email: string;
  // Client-side Student.id values, translated to row positions at submit.
  childIds: string[];
}
interface StudentPin {
  name: string;
  halaqa: string;
  pin: string;
}
interface TeacherLogin {
  name: string;
  email: string;
  password: string;
}
interface ParentLogin {
  name: string;
  email: string;
  password: string;
  children: string[];
}

const inputClass =
  "w-full bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/40 transition";
const labelClass = "block text-sm font-semibold text-ink mb-2";
const primaryBtn =
  "gradient-emerald text-white font-semibold py-3 px-6 rounded-2xl disabled:opacity-40 hover:opacity-90 active:scale-[.98] transition-all";
const ghostBtn =
  "px-6 py-3 rounded-2xl border border-surface-border text-ink hover:bg-surface-bg-warm transition";

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    slug: string;
    adminEmail: string;
    teachers: TeacherLogin[];
    students: StudentPin[];
    parents: ParentLogin[];
  } | null>(null);

  // Read after mount rather than at render: the completion screen prints
  // links a school is meant to copy and hand out, and a bare "/login?school="
  // is not something a non-technical admin can paste anywhere useful.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const [school, setSchool] = useState<SchoolForm>({ name: "", city: "", province: "AB", timezone: "America/Edmonton" });
  const [admin, setAdmin] = useState<AdminForm>({ fullName: "", email: "", password: "" });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [tempTeacher, setTempTeacher] = useState({ name: "", email: "", halaqa: "" });
  const [tempStudent, setTempStudent] = useState({ name: "", age: "10", halaqa: "" });
  const [tempParent, setTempParent] = useState<{ name: string; email: string; childIds: string[] }>({
    name: "",
    email: "",
    childIds: [],
  });
  const [parentError, setParentError] = useState<string | null>(null);
  const [childFilter, setChildFilter] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const addTeacher = () => {
    if (!tempTeacher.name || !tempTeacher.email || !tempTeacher.halaqa) return;
    setTeachers([...teachers, { id: crypto.randomUUID(), ...tempTeacher }]);
    setTempTeacher({ name: "", email: "", halaqa: "" });
  };
  const removeTeacher = (id: string) => setTeachers(teachers.filter((t) => t.id !== id));

  const addStudent = () => {
    if (!tempStudent.name || !tempStudent.halaqa) return;
    setStudents([...students, { id: crypto.randomUUID(), ...tempStudent }]);
    setTempStudent({ name: "", age: "10", halaqa: "" });
  };
  // Dropping a student also drops them from any parent who was linked to
  // them, and a parent left with no children goes too — a parent account
  // exists only to watch a child, so an empty one is just a login into a
  // blank portal.
  const removeStudent = (id: string) => {
    setStudents(students.filter((s) => s.id !== id));
    setParents(
      parents
        .map((p) => ({ ...p, childIds: p.childIds.filter((c) => c !== id) }))
        .filter((p) => p.childIds.length > 0)
    );
    setTempParent((p) => ({ ...p, childIds: p.childIds.filter((c) => c !== id) }));
  };

  const emailTaken = (email: string, ignoreParentId?: string) => {
    const e = email.trim().toLowerCase();
    if (admin.email.trim().toLowerCase() === e) return "the admin";
    if (teachers.some((t) => t.email.trim().toLowerCase() === e)) return "a teacher";
    if (parents.some((p) => p.id !== ignoreParentId && p.email.trim().toLowerCase() === e)) {
      return "another parent";
    }
    return null;
  };

  const toggleChild = (studentId: string) =>
    setTempParent((p) => ({
      ...p,
      childIds: p.childIds.includes(studentId)
        ? p.childIds.filter((c) => c !== studentId)
        : [...p.childIds, studentId],
    }));

  const addParent = () => {
    const name = tempParent.name.trim();
    const email = tempParent.email.trim();
    if (!name || !email || tempParent.childIds.length === 0) return;

    // The server refuses a duplicate too, but only after the whole form is
    // submitted — catching it here means the admin fixes one field instead
    // of being bounced off the last screen.
    const clash = emailTaken(email);
    if (clash) {
      setParentError(`${email} is already used by ${clash}. Each account needs its own email.`);
      return;
    }

    setParents([...parents, { id: crypto.randomUUID(), name, email, childIds: tempParent.childIds }]);
    setTempParent({ name: "", email: "", childIds: [] });
    setParentError(null);
    setChildFilter("");
  };
  const removeParent = (id: string) => setParents(parents.filter((p) => p.id !== id));

  const importRoster = async (file: File) => {
    setImporting(true);
    setImportError(null);
    setImportWarnings([]);
    setImportNotice(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/onboard/parse-roster", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Couldn't read that file.");

      type ParsedRow = {
        name: string;
        age: number | null;
        halaqa: string;
        parentName?: string;
        parentEmail?: string;
      };
      const rows: ParsedRow[] = payload.students;

      const imported: Student[] = rows.map((s) => ({
        id: crypto.randomUUID(),
        name: s.name,
        age: s.age != null ? String(s.age) : "10",
        halaqa: s.halaqa,
      }));
      setStudents([...students, ...imported]);

      // If the sheet carried a parent contact, build the parent accounts
      // from it too. Siblings share one row each but one parent email, so
      // rows are grouped by address — the family gets a single login that
      // sees both children, not two logins seeing one each.
      const nextParents: Parent[] = parents.map((p) => ({ ...p }));
      const byEmail = new Map(nextParents.map((p) => [p.email.trim().toLowerCase(), p]));
      const skipped: string[] = [];
      let added = 0;
      let linked = 0;

      rows.forEach((row, i) => {
        const email = (row.parentEmail ?? "").trim().toLowerCase();
        if (!email) return;

        // Reusing an admin's or teacher's address would collide server-side
        // and fail the whole submission, so those rows are reported instead.
        if (
          admin.email.trim().toLowerCase() === email ||
          teachers.some((t) => t.email.trim().toLowerCase() === email)
        ) {
          if (!skipped.includes(email)) skipped.push(email);
          return;
        }

        const existing = byEmail.get(email);
        if (existing) {
          if (!existing.childIds.includes(imported[i].id)) {
            existing.childIds.push(imported[i].id);
            linked++;
          }
          return;
        }
        const parent: Parent = {
          id: crypto.randomUUID(),
          name: (row.parentName ?? "").trim() || `${row.name}'s parent`,
          email,
          childIds: [imported[i].id],
        };
        byEmail.set(email, parent);
        nextParents.push(parent);
        added++;
        linked++;
      });

      setParents(nextParents);
      const notices: string[] = [];
      if (added > 0) {
        notices.push(
          `Also read ${added} parent${added === 1 ? "" : "s"} covering ${linked} child${
            linked === 1 ? "" : "ren"
          } — check them on the Parents step.`
        );
      }
      if (skipped.length > 0) {
        notices.push(
          `Skipped ${skipped.join(", ")} as a parent — already used by the admin or a teacher.`
        );
      }
      setImportNotice(notices.length > 0 ? notices.join(" ") : null);

      setImportWarnings(payload.warnings ?? []);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setImporting(false);
    }
  };

  const halaqas = Array.from(
    new Set([...teachers.map((t) => t.halaqa), ...students.map((s) => s.halaqa)])
  )
    .filter(Boolean)
    .sort();

  const unclaimedStudents = students.filter(
    (s) => !parents.some((p) => p.childIds.includes(s.id))
  );

  const canProceed = () => {
    switch (step) {
      case "school":
        return school.name.trim() && school.city.trim();
      case "admin":
        return admin.fullName.trim() && admin.email.trim() && admin.password.length >= 8;
      case "teachers":
        return teachers.length > 0;
      case "students":
        return students.length > 0;
      default:
        return true;
    }
  };

  const goNext = () => {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  };
  const goBack = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school,
          admin,
          teachers: teachers.map((t) => ({ name: t.name, email: t.email, halaqa: t.halaqa })),
          students: students.map((s) => ({ name: s.name, age: parseInt(s.age, 10) || 0, halaqa: s.halaqa })),
          // Children go over as positions in the students array above, not
          // names: the server inserts students in that order and links each
          // parent to the ids it gets back, so two children with the same
          // name can't be confused for one another.
          parents: parents.map((p) => ({
            name: p.name,
            email: p.email,
            studentIndexes: p.childIds
              .map((id) => students.findIndex((s) => s.id === id))
              .filter((i) => i >= 0),
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Onboarding failed");
      setResult(payload);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="gradient-navy px-6 py-10 relative overflow-hidden">
        <div className="pattern-lattice absolute inset-0 opacity-40 pointer-events-none" />
        <div className="max-w-2xl mx-auto relative">
          <h1 className="font-display text-3xl font-bold text-white">
            Set up your school on <span className="gold-foil">MyDiiwaan</span>
          </h1>
          <p className="text-white/60 mt-2 text-[15px]">A few minutes to add your teachers, students, parents, and halaqas.</p>
        </div>
      </header>

      {step !== "complete" && (
        <div className="max-w-2xl mx-auto px-6 pt-6">
          <div className="flex justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-colors ${
                    s === step
                      ? "bg-brand-navy text-white"
                      : STEPS.indexOf(step) > i
                      ? "bg-brand-emerald text-white"
                      : "bg-surface-border text-ink-muted"
                  }`}
                >
                  {STEPS.indexOf(step) > i ? "✓" : i + 1}
                </div>
                <span className="text-[10px] text-center text-ink-muted">{STEP_LABELS[s]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-6 py-8">
        {step === "welcome" && (
          <div className="card-quiet p-8 text-center space-y-5">
            <div className="text-5xl">🕌</div>
            <h2 className="text-xl font-bold text-ink">Let&apos;s get your school set up</h2>
            <p className="text-ink-muted text-[15px]">
              You&apos;ll add your school&apos;s name, create your admin login, then add your teachers,
              students, parents, and halaqas. Have your roster ready — this takes about 5 minutes.
            </p>
            <div className="bg-status-info-bg rounded-2xl p-4 text-start">
              <p className="text-sm text-status-info-text">
                💡 Each student gets a 4-digit PIN generated automatically — you&apos;ll get a printable list at the end to hand out.
              </p>
            </div>
            <button onClick={goNext} className={primaryBtn}>
              Get started →
            </button>
          </div>
        )}

        {step === "school" && (
          <div className="card-quiet p-8 space-y-5">
            <h2 className="text-xl font-bold text-ink">School information</h2>
            <div>
              <label className={labelClass}>School name</label>
              <input
                value={school.name}
                onChange={(e) => setSchool({ ...school, name: e.target.value })}
                placeholder="e.g., Al Taqwa Academy"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>City</label>
                <input
                  value={school.city}
                  onChange={(e) => setSchool({ ...school, city: e.target.value })}
                  placeholder="e.g., Edmonton"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Province</label>
                <select
                  value={school.province}
                  onChange={(e) => setSchool({ ...school, province: e.target.value })}
                  className={inputClass}
                >
                  {["AB", "ON", "BC", "MB", "SK", "QC", "NB", "NS", "PE", "NL"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Timezone</label>
              <select
                value={school.timezone}
                onChange={(e) => setSchool({ ...school, timezone: e.target.value })}
                className={inputClass}
              >
                <option value="America/Edmonton">America/Edmonton</option>
                <option value="America/Toronto">America/Toronto</option>
                <option value="America/Vancouver">America/Vancouver</option>
                <option value="America/Winnipeg">America/Winnipeg</option>
              </select>
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className={ghostBtn}>← Back</button>
              <button onClick={goNext} disabled={!canProceed()} className={primaryBtn}>Next →</button>
            </div>
          </div>
        )}

        {step === "admin" && (
          <div className="card-quiet p-8 space-y-5">
            <h2 className="text-xl font-bold text-ink">Create your admin login</h2>
            <p className="text-ink-muted text-sm">This is what you&apos;ll use to sign into the Admin Portal.</p>
            <div>
              <label className={labelClass}>Full name</label>
              <input
                value={admin.fullName}
                onChange={(e) => setAdmin({ ...admin, fullName: e.target.value })}
                placeholder="e.g., Ahmed Hassan"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={admin.email}
                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                placeholder="you@yourschool.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={admin.password}
                onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                placeholder="At least 8 characters"
                className={inputClass}
              />
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className={ghostBtn}>← Back</button>
              <button onClick={goNext} disabled={!canProceed()} className={primaryBtn}>Next →</button>
            </div>
          </div>
        )}

        {step === "teachers" && (
          <div className="card-quiet p-8 space-y-5">
            <h2 className="text-xl font-bold text-ink">Add your teachers</h2>
            <p className="text-ink-muted text-sm">Each teacher gets their own halaqa (class).</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={tempTeacher.name}
                onChange={(e) => setTempTeacher({ ...tempTeacher, name: e.target.value })}
                placeholder="Name"
                className={inputClass}
              />
              <input
                value={tempTeacher.email}
                onChange={(e) => setTempTeacher({ ...tempTeacher, email: e.target.value })}
                placeholder="Email"
                className={inputClass}
              />
              <input
                value={tempTeacher.halaqa}
                onChange={(e) => setTempTeacher({ ...tempTeacher, halaqa: e.target.value })}
                placeholder="Halaqa (e.g., Halaqa A)"
                className={inputClass}
              />
            </div>
            <button
              onClick={addTeacher}
              disabled={!tempTeacher.name || !tempTeacher.email || !tempTeacher.halaqa}
              className="w-full py-2.5 rounded-2xl border-2 border-dashed border-surface-border text-ink-muted hover:border-emerald-600 hover:text-emerald-600 disabled:opacity-40 transition"
            >
              + Add teacher
            </button>
            {teachers.length > 0 && (
              <ul className="divide-y divide-surface-border">
                {teachers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">{t.name}</p>
                      <p className="text-xs text-ink-muted">{t.email} · {t.halaqa}</p>
                    </div>
                    <button onClick={() => removeTeacher(t.id)} className="text-status-error-text text-sm hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className={ghostBtn}>← Back</button>
              <button onClick={goNext} disabled={!canProceed()} className={primaryBtn}>Next →</button>
            </div>
          </div>
        )}

        {step === "students" && (
          <div className="card-quiet p-8 space-y-5">
            <h2 className="text-xl font-bold text-ink">Add your students</h2>
            <p className="text-ink-muted text-sm">Assign each student to a halaqa. PINs are generated automatically.</p>

            <div className="rounded-2xl border border-dashed border-surface-border p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-ink">Already have a roster?</p>
                <p className="text-xs text-ink-muted mt-0.5">
                  Upload a spreadsheet or Word doc with Name, Age (or Grade), and Halaqa columns —
                  we&apos;ll add everyone we can read from it. Add a{" "}
                  <span className="font-semibold">Parent Email</span> column and we&apos;ll build the
                  parent accounts too.
                </p>
              </div>
              <label className={`${ghostBtn} cursor-pointer flex-shrink-0 ${importing ? "opacity-50 pointer-events-none" : ""}`}>
                {importing ? "Reading…" : "Upload file"}
                <input
                  type="file"
                  accept=".xlsx,.csv,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importRoster(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {importError && (
              <p className="text-sm text-status-error-text bg-status-error-bg rounded-xl px-3 py-2">{importError}</p>
            )}
            {importNotice && (
              <p className="text-sm text-status-info-text bg-status-info-bg rounded-xl px-3 py-2">
                {importNotice}
              </p>
            )}
            {importWarnings.length > 0 && (
              <div className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/25 rounded-xl px-3 py-2 space-y-0.5">
                {importWarnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                value={tempStudent.name}
                onChange={(e) => setTempStudent({ ...tempStudent, name: e.target.value })}
                placeholder="Name"
                className={inputClass}
              />
              <select
                value={tempStudent.age}
                onChange={(e) => setTempStudent({ ...tempStudent, age: e.target.value })}
                className={inputClass}
              >
                {Array.from({ length: 15 }, (_, i) => i + 4).map((age) => (
                  <option key={age} value={age}>{age} years old</option>
                ))}
              </select>
              <select
                value={tempStudent.halaqa}
                onChange={(e) => setTempStudent({ ...tempStudent, halaqa: e.target.value })}
                className={inputClass}
              >
                <option value="">Select halaqa…</option>
                {Array.from(new Set(teachers.map((t) => t.halaqa))).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <button
              onClick={addStudent}
              disabled={!tempStudent.name || !tempStudent.halaqa}
              className="w-full py-2.5 rounded-2xl border-2 border-dashed border-surface-border text-ink-muted hover:border-emerald-600 hover:text-emerald-600 disabled:opacity-40 transition"
            >
              + Add student
            </button>
            {students.length > 0 && (
              <ul className="divide-y divide-surface-border">
                {students.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-ink-muted">{s.age} years old · {s.halaqa}</p>
                    </div>
                    <button onClick={() => removeStudent(s.id)} className="text-status-error-text text-sm hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className={ghostBtn}>← Back</button>
              <button onClick={goNext} disabled={!canProceed()} className={primaryBtn}>Next →</button>
            </div>
          </div>
        )}

        {step === "parents" && (
          <div className="card-quiet p-8 space-y-5">
            <h2 className="text-xl font-bold text-ink">Add parent accounts</h2>
            <p className="text-ink-muted text-sm">
              A parent signs in and sees only their own children&apos;s attendance and memorisation.
              Tick every child who belongs to them — one login covers a whole family.
            </p>

            <div className="bg-status-info-bg rounded-2xl p-4">
              <p className="text-sm text-status-info-text">
                💡 This step is optional. Skip it and add parents later from{" "}
                <span className="font-semibold">Admin → Parents</span> — nothing else waits on it.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={tempParent.name}
                onChange={(e) => setTempParent({ ...tempParent, name: e.target.value })}
                placeholder="Parent name"
                className={inputClass}
              />
              <input
                type="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={tempParent.email}
                onChange={(e) => {
                  setTempParent({ ...tempParent, email: e.target.value });
                  setParentError(null);
                }}
                placeholder="Parent email"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Their children
                {tempParent.childIds.length > 0 && (
                  <span className="font-normal text-ink-muted"> · {tempParent.childIds.length} selected</span>
                )}
              </label>
              {students.length > 8 && (
                <input
                  value={childFilter}
                  onChange={(e) => setChildFilter(e.target.value)}
                  placeholder="Search students…"
                  className={`${inputClass} mb-2`}
                />
              )}
              <div className="border border-surface-border rounded-2xl max-h-56 overflow-y-auto divide-y divide-surface-border">
                {students
                  .filter((s) => s.name.toLowerCase().includes(childFilter.trim().toLowerCase()))
                  .map((s) => {
                    // A child already spoken for stays tickable — a second
                    // parent or a guardian is a normal second account, and
                    // the note just says who already has them.
                    const claimedBy = parents.find((p) => p.childIds.includes(s.id));
                    return (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-bg-warm transition"
                      >
                        <input
                          type="checkbox"
                          checked={tempParent.childIds.includes(s.id)}
                          onChange={() => toggleChild(s.id)}
                          className="w-4 h-4 accent-emerald-600 flex-shrink-0"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink truncate">{s.name}</span>
                          <span className="block text-xs text-ink-muted truncate">
                            {s.halaqa}
                            {claimedBy ? ` · already linked to ${claimedBy.name}` : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                {students.filter((s) => s.name.toLowerCase().includes(childFilter.trim().toLowerCase()))
                  .length === 0 && (
                  <p className="px-4 py-3 text-sm text-ink-muted">No student matches that search.</p>
                )}
              </div>
            </div>

            {parentError && (
              <p className="text-sm text-status-error-text bg-status-error-bg rounded-xl px-3 py-2">
                {parentError}
              </p>
            )}

            <button
              onClick={addParent}
              disabled={!tempParent.name.trim() || !tempParent.email.trim() || tempParent.childIds.length === 0}
              className="w-full py-2.5 rounded-2xl border-2 border-dashed border-surface-border text-ink-muted hover:border-emerald-600 hover:text-emerald-600 disabled:opacity-40 transition"
            >
              + Add parent
            </button>

            {parents.length > 0 && (
              <ul className="divide-y divide-surface-border">
                {parents.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{p.name}</p>
                      <p className="text-xs text-ink-muted break-all">{p.email}</p>
                      <p className="text-xs text-ink-muted">
                        {p.childIds
                          .map((id) => students.find((s) => s.id === id)?.name)
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => removeParent(p.id)}
                      className="text-status-error-text text-sm hover:underline flex-shrink-0"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {unclaimedStudents.length > 0 && parents.length > 0 && (
              <p className="text-xs text-ink-muted">
                {unclaimedStudents.length} student{unclaimedStudents.length === 1 ? " has" : "s have"} no
                parent account yet: {unclaimedStudents.slice(0, 6).map((s) => s.name).join(", ")}
                {unclaimedStudents.length > 6 ? `, and ${unclaimedStudents.length - 6} more` : ""}.
              </p>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={goBack} className={ghostBtn}>← Back</button>
              <button onClick={goNext} className={primaryBtn}>
                {parents.length === 0 ? "Skip for now →" : "Next →"}
              </button>
            </div>
          </div>
        )}

        {step === "halaqas" && (
          <div className="card-quiet p-8 space-y-5">
            <h2 className="text-xl font-bold text-ink">Your halaqas</h2>
            <p className="text-ink-muted text-sm">Built automatically from the teachers and students you added.</p>
            <ul className="divide-y divide-surface-border">
              {halaqas.map((h) => {
                const teacher = teachers.find((t) => t.halaqa === h);
                const count = students.filter((s) => s.halaqa === h).length;
                return (
                  <li key={h} className="py-3">
                    <p className="text-sm font-semibold text-ink">{h}</p>
                    <p className="text-xs text-ink-muted">
                      {teacher ? teacher.name : "No teacher assigned"} · {count} student{count === 1 ? "" : "s"}
                    </p>
                  </li>
                );
              })}
            </ul>
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className={ghostBtn}>← Back</button>
              <button onClick={goNext} className={primaryBtn}>Next →</button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="card-quiet p-8 space-y-5">
            <h2 className="text-xl font-bold text-ink">Review &amp; confirm</h2>
            <div className="space-y-3 text-sm">
              <p><span className="text-ink-muted">School:</span> <span className="font-semibold text-ink">{school.name}, {school.city}, {school.province}</span></p>
              <p><span className="text-ink-muted">Admin:</span> <span className="font-semibold text-ink">{admin.fullName} ({admin.email})</span></p>
              <p><span className="text-ink-muted">Teachers:</span> <span className="font-semibold text-ink">{teachers.length}</span></p>
              <p><span className="text-ink-muted">Students:</span> <span className="font-semibold text-ink">{students.length}</span></p>
              <p>
                <span className="text-ink-muted">Parents:</span>{" "}
                <span className="font-semibold text-ink">
                  {parents.length === 0 ? "none — add them later from Admin → Parents" : parents.length}
                </span>
              </p>
              <p><span className="text-ink-muted">Halaqas:</span> <span className="font-semibold text-ink">{halaqas.length}</span></p>
            </div>
            {error && (
              <p className="text-status-error-text bg-status-error-bg rounded-card px-4 py-2.5 text-sm">{error}</p>
            )}
            <div className="flex justify-between pt-2">
              <button onClick={goBack} className={ghostBtn} disabled={loading}>← Back</button>
              <button onClick={submit} disabled={loading} className={primaryBtn}>
                {loading ? "Setting up…" : "Confirm & create school"}
              </button>
            </div>
          </div>
        )}

        {step === "complete" && result && (
          <div className="space-y-5">
            <div className="card-quiet p-8 text-center space-y-4">
              <div className="text-5xl">🎉</div>
              <h2 className="text-xl font-bold text-ink">Your school is ready!</h2>
              <p className="text-ink-muted text-sm">
                Sign in at <span className="font-semibold text-ink">/login</span> with <span className="font-semibold text-ink">{result.adminEmail}</span> and the password you chose.
              </p>
              <div className="bg-status-info-bg rounded-2xl p-4 text-start space-y-1.5">
                <p className="text-sm font-semibold text-status-info-text">Your students&apos; login link</p>
                <p className="font-mono text-[12px] text-status-info-text break-all">
                  {origin}/login?school={result.slug}
                </p>
                <p className="text-[11px] text-status-info-text/80">
                  Students must use this exact link — it&apos;s what shows them your school&apos;s names to tap.
                  The plain login page won&apos;t know which school they belong to.
                </p>
              </div>
              <button onClick={() => router.push("/login")} className={primaryBtn}>Go to login →</button>
            </div>

            {result.teachers.length > 0 && (
              <div className="card-quiet p-6">
                <h3 className="font-bold text-ink mb-1">Teacher logins</h3>
                <p className="text-ink-muted text-xs mb-4">
                  Give each teacher their email and temporary password — they sign in at{" "}
                  <span className="font-mono">{origin}/login</span> under &ldquo;Teacher&rdquo;, and
                  will be asked to set their own password the first time.
                </p>
                <ul className="divide-y divide-surface-border">
                  {result.teachers.map((t) => (
                    <li key={t.email} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{t.name}</p>
                        <p className="text-xs text-ink-muted break-all">{t.email}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-brand-navy dark:text-brand-gold flex-shrink-0">
                        {t.password}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.parents?.length > 0 && (
              <div className="card-quiet p-6">
                <h3 className="font-bold text-ink mb-1">Parent logins</h3>
                <p className="text-ink-muted text-xs mb-4">
                  Send each family their email and temporary password — they sign in at{" "}
                  <span className="font-mono">{origin}/login</span> under &ldquo;Parent&rdquo;, and
                  will be asked to set their own password the first time.
                </p>
                <ul className="divide-y divide-surface-border">
                  {result.parents.map((p) => (
                    <li key={p.email} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{p.name}</p>
                        <p className="text-xs text-ink-muted break-all">{p.email}</p>
                        <p className="text-xs text-ink-muted">{p.children.join(", ")}</p>
                      </div>
                      <span className="font-mono text-sm font-bold text-brand-navy dark:text-brand-gold flex-shrink-0">
                        {p.password}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card-quiet p-6">
              <h3 className="font-bold text-ink mb-1">Student PINs</h3>
              <p className="text-ink-muted text-xs mb-4">Print this and hand a PIN to each student — they&apos;ll tap their name on the login screen and enter it.</p>
              <ul className="divide-y divide-surface-border">
                {/* Keyed by position, not name: two children called Muhammad
                    Ali is normal, and a duplicate key lets React drop one of
                    them — which would hand the school a PIN list missing a
                    student. */}
                {result.students.map((s, i) => (
                  <li key={`${s.name}-${i}`} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-ink-muted">{s.halaqa}</p>
                    </div>
                    <span className="font-mono text-lg font-bold text-brand-navy dark:text-brand-gold tracking-widest">{s.pin}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
