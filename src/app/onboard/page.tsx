"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "welcome" | "school" | "admin" | "teachers" | "students" | "halaqas" | "review" | "complete";

const STEPS: Step[] = ["welcome", "school", "admin", "teachers", "students", "halaqas", "review"];
const STEP_LABELS: Record<Step, string> = {
  welcome: "Welcome",
  school: "School",
  admin: "Admin",
  teachers: "Teachers",
  students: "Students",
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
  const [tempTeacher, setTempTeacher] = useState({ name: "", email: "", halaqa: "" });
  const [tempStudent, setTempStudent] = useState({ name: "", age: "10", halaqa: "" });
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

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
  const removeStudent = (id: string) => setStudents(students.filter((s) => s.id !== id));

  const importRoster = async (file: File) => {
    setImporting(true);
    setImportError(null);
    setImportWarnings([]);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/onboard/parse-roster", { method: "POST", body });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Couldn't read that file.");

      const imported: Student[] = payload.students.map(
        (s: { name: string; age: number | null; halaqa: string }) => ({
          id: crypto.randomUUID(),
          name: s.name,
          age: s.age != null ? String(s.age) : "10",
          halaqa: s.halaqa,
        })
      );
      setStudents([...students, ...imported]);
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
          <p className="text-white/60 mt-2 text-[15px]">A few minutes to add your teachers, students, and halaqas.</p>
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
              You&apos;ll add your school&apos;s name, create your admin login, then add your teachers, students, and halaqas.
              Have your roster ready — this takes about 5 minutes.
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
                  we&apos;ll add everyone we can read from it.
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

            <div className="card-quiet p-6">
              <h3 className="font-bold text-ink mb-1">Student PINs</h3>
              <p className="text-ink-muted text-xs mb-4">Print this and hand a PIN to each student — they&apos;ll tap their name on the login screen and enter it.</p>
              <ul className="divide-y divide-surface-border">
                {result.students.map((s) => (
                  <li key={s.name} className="flex items-center justify-between py-2.5">
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
