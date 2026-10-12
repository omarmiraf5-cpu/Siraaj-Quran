"use client";

import { useMemo, useState } from "react";
import { useAgreements } from "@/hooks/useAgreements";
import type { DemoHalaqa } from "@/data/demo";
import type { Campus } from "@/lib/schoolStructure";
import { gradeLabel } from "@/lib/grades";
import { download, fileNameFor, printPinSheet } from "@/lib/sheetTools";

// The office bringing in its students from the spreadsheet it already keeps:
// read, checked over, then sent a batch at a time so a school of hundreds
// never rides on one long request. What comes back is each child's PIN to
// hand out, and each new parent's temporary password.

interface SheetRow {
  name: string;
  grade: number | null;
  gradeText: string;
  campus: string;
  halaqa: string;
  parentName: string;
  parentEmail: string;
}
interface RowResult {
  status: "added" | "skipped" | "failed";
  name: string;
  place?: string;
  pin?: string;
  reason?: string;
  parent?: { email: string; status: "created" | "linked" | "failed"; reason?: string; temp_password?: string };
}

const BATCH = 20;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const button =
  "gradient-emerald text-white text-sm font-semibold px-4 py-2.5 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-40";
const ghost =
  "text-sm font-semibold px-4 py-2.5 rounded-2xl border border-surface-border text-ink hover:bg-surface-bg-warm transition disabled:opacity-40";

const TEMPLATE = [
  ["Name", "Grade", "Campus", "Halaqa", "Parent Name", "Parent Email"],
  ["Amina Yusuf", "3", "North", "Halaqa A", "Hodan Ali", "hodan@example.com"],
  ["Bilal Yusuf", "K", "North", "Halaqa A", "Hodan Ali", "hodan@example.com"],
];

export default function StudentImport({
  graded,
  campuses,
  halaqas,
  schoolName,
  onDone,
  onClose,
}: {
  graded: boolean;
  campuses: Campus[];
  halaqas: DemoHalaqa[];
  schoolName: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const { agreements, accept, error: consentError } = useAgreements(true);
  const needsConsent = !!agreements?.available && !agreements.consentConfirmed;
  const [consentTick, setConsentTick] = useState(false);
  const [phase, setPhase] = useState<"pick" | "preview" | "importing" | "done">("pick");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [defaultCampus, setDefaultCampus] = useState("");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);

  const read = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/onboard/parse-roster", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read that file");
      setRows(body.students as SheetRow[]);
      setWarnings(((body.warnings ?? []) as string[]).filter((w) => !/Age|age by hand|next step/.test(w)));
      setFileName(file.name);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setReading(false);
    }
  };

  // What the sheet would do, before anything is sent.
  const plan = useMemo(() => {
    const sheetCampuses = [...new Set(rows.map((r) => r.campus.trim()).filter(Boolean))];
    const campusNames = [...new Map([...campuses.map((c) => c.name), ...sheetCampuses].map((n) => [key(n), n])).values()];
    const newCampuses = sheetCampuses.filter((n) => !campuses.some((c) => key(c.name) === key(n)));
    const campusOf = (r: SheetRow) => r.campus.trim() || defaultCampus || (campusNames.length === 1 ? campusNames[0] : "");
    const noGrade = graded ? rows.filter((r) => r.grade === null) : [];
    const noCampus = campusNames.length > 1 ? rows.filter((r) => r.halaqa.trim() && !campusOf(r)) : [];
    const badEmail = rows.filter((r) => r.parentEmail && !EMAIL.test(r.parentEmail));
    const existing = new Set(
      halaqas.map((h) => `${key(campuses.find((c) => c.id === h.campusId)?.name ?? "")}|${graded ? h.grade ?? 0 : ""}|${key(h.name)}`)
    );
    const wanted = new Set(
      rows
        // Only the rows that will go in: a grade it can read, and a campus when there's a choice.
        .filter((r) => r.halaqa.trim() && (!graded || r.grade !== null) && (campusNames.length <= 1 || campusOf(r)))
        .map((r) => `${key(campusNames.length > 0 ? campusOf(r) : "")}|${graded ? r.grade : ""}|${key(r.halaqa)}`)
    );
    const grades = [...new Set(rows.map((r) => r.grade).filter((g): g is number => g !== null))].sort((a, b) => a - b);
    return {
      campusNames,
      newCampuses,
      campusOf,
      noGrade,
      noCampus,
      badEmail,
      halaqaCount: wanted.size,
      newHalaqas: [...wanted].filter((w) => !existing.has(w)).length,
      parents: new Set(rows.map((r) => key(r.parentEmail)).filter((e) => EMAIL.test(e))).size,
      grades,
    };
  }, [rows, campuses, halaqas, graded, defaultCampus]);

  const run = async () => {
    // Children's records come in here: the school confirms it has their
    // parents' agreement first, once.
    if (needsConsent && !(await accept("consent"))) return;
    setPhase("importing");
    setProgress(0);
    // What the preview said can't be added isn't sent: it's reported as it was shown.
    const held = new Map<SheetRow, string>([
      ...plan.noGrade.map((r) => [r, "No grade — give Pre-K, Kindergarten (K) or a grade from 1 to 12"] as [SheetRow, string]),
      ...plan.noCampus.map((r) => [r, "Which campus? Fill in the Campus column"] as [SheetRow, string]),
    ]);
    const out: RowResult[] = [...held].map(([r, reason]) => ({ status: "failed" as const, name: r.name, reason }));
    setProgress(held.size);
    const toSend = rows.filter((r) => !held.has(r)).map((r) => ({
      name: r.name,
      grade: r.grade,
      campus: plan.campusOf(r),
      halaqa: r.halaqa,
      parentName: r.parentName,
      parentEmail: r.parentEmail,
    }));
    for (let i = 0; i < toSend.length; i += BATCH) {
      const batch = toSend.slice(i, i + BATCH);
      let answer: RowResult[] | null = null;
      // Once more if a batch doesn't get through: rows already added are
      // skipped the second time, so nothing is made twice.
      for (let attempt = 0; attempt < 2 && !answer; attempt++) {
        try {
          const res = await fetch("/api/admin/import-students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: batch }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok && Array.isArray(body.results)) answer = body.results;
          else if (res.status < 500) {
            answer = batch.map((r) => ({ status: "failed" as const, name: r.name, reason: body.error ?? "Not imported" }));
          }
        } catch {
          // Tried again below.
        }
      }
      out.push(
        ...(answer ??
          batch.map((r) => ({
            status: "failed" as const,
            name: r.name,
            reason: "The import didn't get through. Import the same sheet again — students already added are skipped.",
          })))
      );
      setProgress(held.size + Math.min(i + BATCH, toSend.length));
      setResults([...out]);
    }
    setResults([...out]);
    setPhase("done");
    onDone();
  };

  const added = results.filter((r) => r.status === "added");
  const skipped = results.filter((r) => r.status === "skipped");
  const failed = results.filter((r) => r.status === "failed");
  const newParents = [...new Map(results.filter((r) => r.parent?.status === "created").map((r) => [r.parent!.email, r.parent!])).values()];
  const linkedParents = new Set(results.filter((r) => r.parent?.status === "linked").map((r) => r.parent!.email)).size;
  const parentProblems = results.filter((r) => r.parent?.status === "failed");

  const printPins = () => printPinSheet(schoolName, added, newParents);

  const downloadResults = () =>
    download(fileNameFor(schoolName, "import"), [
      ["Student", "Halaqa", "PIN", "Result", "Problem", "Parent email", "Parent login", "Parent temporary password"],
      ...results.map((r) => [
        r.name,
        r.place ?? "",
        r.pin ?? "",
        r.status,
        r.reason ?? r.parent?.reason ?? "",
        r.parent?.email ?? "",
        r.parent?.status ?? "",
        r.parent?.temp_password ?? "",
      ]),
    ]);

  return (
    <section aria-label="Import students" className="card-quiet p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Import students from a spreadsheet</h2>
          <p className="text-[12.5px] text-ink-muted mt-1 leading-relaxed">
            One row per student. Columns: <strong>Name</strong>
            {graded ? (
              <>
                , <strong>Grade</strong> (Pre-K, K, or 1 to 12)
              </>
            ) : null}
            , <strong>Halaqa</strong>
            {graded || campuses.length > 0 ? (
              <>
                , <strong>Campus</strong>
              </>
            ) : null}
            , and <strong>Parent Name</strong> and <strong>Parent Email</strong> if you have them. Halaqas and campuses
            the school doesn&apos;t have yet are made for you; brothers and sisters with the same parent email share one
            parent login.
          </p>
        </div>
        {phase !== "importing" && (
          <button type="button" onClick={onClose} className="text-[13px] font-semibold text-ink-muted hover:text-ink px-2">
            Close
          </button>
        )}
      </div>

      {phase === "pick" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className={`${button} cursor-pointer`}>
              {reading ? "Reading…" : "Choose a file"}
              <input
                type="file"
                accept=".xlsx,.csv,.docx"
                className="sr-only"
                disabled={reading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) read(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button type="button" onClick={() => download("students template.csv", TEMPLATE)} className={ghost}>
              Download a template
            </button>
          </div>
          <p className="text-[11.5px] text-ink-muted">Excel (.xlsx), CSV, or a Word document with a table. Old .xls files: save as .xlsx first.</p>
          {error && <p role="alert" className="text-[12.5px] text-red-700 dark:text-red-300">{error}</p>}
        </div>
      )}

      {phase === "preview" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-bg-warm border border-surface-border p-4 text-[13px] text-ink space-y-1">
            <p>
              <strong>{rows.length}</strong> students in <span className="text-ink-muted">{fileName}</span>
            </p>
            {graded && plan.grades.length > 0 && (
              <p>
                Grades: {plan.grades.length > 3 ? `${gradeLabel(plan.grades[0])} to ${gradeLabel(plan.grades[plan.grades.length - 1])}` : plan.grades.map(gradeLabel).join(", ")}
              </p>
            )}
            {plan.campusNames.length > 0 && (
              <p>
                Campuses: {plan.campusNames.join(", ")}
                {plan.newCampuses.length > 0 && <span className="text-ink-muted"> ({plan.newCampuses.join(", ")} new)</span>}
              </p>
            )}
            <p>
              {plan.halaqaCount} halaqa{plan.halaqaCount === 1 ? "" : "s"}
              {plan.newHalaqas > 0 && <span className="text-ink-muted"> ({plan.newHalaqas} new, made for you)</span>}
            </p>
            <p>{plan.parents} parent email{plan.parents === 1 ? "" : "s"}</p>
          </div>

          {/* Only a halaqa needs a campus: students without one come in either way. */}
          {plan.campusNames.length > 1 && rows.some((r) => r.halaqa.trim() && !r.campus.trim()) && (
            <label className="block">
              <span className="block text-sm font-semibold text-ink mb-1.5">Campus for the halaqas in rows that don&apos;t say</span>
              <select
                value={defaultCampus}
                onChange={(e) => setDefaultCampus(e.target.value)}
                className="w-full sm:w-72 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 text-sm text-ink"
              >
                <option value="">None — leave those rows out</option>
                {plan.campusNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}

          {(plan.noGrade.length > 0 || plan.noCampus.length > 0 || plan.badEmail.length > 0 || warnings.length > 0) && (
            <div className="rounded-2xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/20 p-4 text-[12.5px] text-amber-900 dark:text-amber-200 space-y-1.5">
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
              {plan.noGrade.length > 0 && (
                <p>
                  <strong>{plan.noGrade.length}</strong> with no grade we can read, so they won&apos;t be added:{" "}
                  {plan.noGrade.slice(0, 6).map((r) => `${r.name}${r.gradeText ? ` ("${r.gradeText}")` : ""}`).join(", ")}
                  {plan.noGrade.length > 6 ? "…" : ""}
                </p>
              )}
              {plan.noCampus.length > 0 && (
                <p>
                  <strong>{plan.noCampus.length}</strong> with no campus, so they won&apos;t be added:{" "}
                  {plan.noCampus.slice(0, 6).map((r) => r.name).join(", ")}
                  {plan.noCampus.length > 6 ? "…" : ""}
                </p>
              )}
              {plan.badEmail.length > 0 && (
                <p>
                  <strong>{plan.badEmail.length}</strong> parent email{plan.badEmail.length === 1 ? " isn't" : "s aren't"} an
                  email address — the child is added, without the parent: {plan.badEmail.slice(0, 4).map((r) => r.parentEmail).join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[12.5px] min-w-[560px]">
              <thead>
                <tr className="eyebrow text-start">
                  <th className="text-start font-semibold py-1.5 px-1">Name</th>
                  {graded && <th className="text-start font-semibold py-1.5 px-1">Grade</th>}
                  {plan.campusNames.length > 0 && <th className="text-start font-semibold py-1.5 px-1">Campus</th>}
                  <th className="text-start font-semibold py-1.5 px-1">Halaqa</th>
                  <th className="text-start font-semibold py-1.5 px-1">Parent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {rows.slice(0, 8).map((r, i) => (
                  <tr key={i}>
                    <td className="py-1.5 px-1 text-ink font-semibold">{r.name}</td>
                    {graded && <td className="py-1.5 px-1">{r.grade !== null ? gradeLabel(r.grade) : <span className="text-amber-700">{r.gradeText || "—"}</span>}</td>}
                    {plan.campusNames.length > 0 && <td className="py-1.5 px-1">{plan.campusOf(r) || "—"}</td>}
                    <td className="py-1.5 px-1">{r.halaqa || "—"}</td>
                    <td className="py-1.5 px-1 text-ink-muted">
                      {r.parentEmail ? (
                        <>
                          <span className="block text-ink">{r.parentName || "—"}</span>
                          <span className="block text-[11px]">{r.parentEmail}</span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 8 && <p className="text-[11.5px] text-ink-muted mt-1.5 px-1">…and {rows.length - 8} more.</p>}
          </div>

          {needsConsent && (
            <label className="flex items-start gap-2.5 text-[13px] text-ink rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-800/40 p-3" data-section="consent">
              <input type="checkbox" checked={consentTick} onChange={(e) => setConsentTick(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-700 flex-shrink-0" />
              <span>
                I confirm the school has these children&apos;s parents&apos; agreement (for example on its enrolment form) to
                their records being kept in MyDiiwaan. Asked once for the school.
              </span>
            </label>
          )}
          {consentError && <p className="text-[12.5px] text-red-700 dark:text-red-300">{consentError}</p>}

          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={run} disabled={rows.length === plan.noGrade.length + plan.noCampus.length || (needsConsent && !consentTick)} className={button}>
              Import {rows.length - new Set([...plan.noGrade, ...plan.noCampus]).size} students
            </button>
            <button type="button" onClick={() => setPhase("pick")} className={ghost}>
              Choose another file
            </button>
          </div>
          <p className="text-[11.5px] text-ink-muted">
            Students already at the school are skipped, so a sheet can be imported again safely. Each new parent is
            emailed a link to choose their password.
          </p>
        </div>
      )}

      {(phase === "importing" || phase === "done") && (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-[12.5px] text-ink mb-1.5">
              <span>{phase === "importing" ? "Adding students…" : "Finished"}</span>
              <span className="tabular-nums">
                {progress} of {rows.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-border overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={rows.length} aria-valuenow={progress}>
              <div className="h-full gradient-emerald transition-all" style={{ width: `${rows.length ? (progress / rows.length) * 100 : 0}%` }} />
            </div>
          </div>

          {phase === "done" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                {[
                  [added.length, "added"],
                  [skipped.length, "already here"],
                  [newParents.length, "new parent logins"],
                  [failed.length, "not added"],
                ].map(([n, label]) => (
                  <div key={label as string} className="rounded-2xl bg-surface-bg-warm border border-surface-border py-3">
                    <p className="text-xl font-bold text-ink tabular-nums">{n}</p>
                    <p className="text-[11.5px] text-ink-muted">{label}</p>
                  </div>
                ))}
              </div>
              {linkedParents > 0 && (
                <p className="text-[12.5px] text-ink-muted">
                  {linkedParents} parent{linkedParents === 1 ? " who already had a login has" : "s who already had logins have"} their
                  children added to it.
                </p>
              )}
              {(failed.length > 0 || parentProblems.length > 0) && (
                <div className="rounded-2xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/20 p-4 text-[12.5px] text-amber-900 dark:text-amber-200">
                  <p className="font-semibold mb-1.5">To sort out</p>
                  <ul className="space-y-1">
                    {failed.map((r, i) => (
                      <li key={`s${i}`}>
                        {r.name || "A row with no name"}: {r.reason}
                      </li>
                    ))}
                    {parentProblems.map((r, i) => (
                      <li key={`p${i}`}>
                        {r.name}&apos;s parent: {r.parent?.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2.5">
                {added.length > 0 && (
                  <button type="button" onClick={printPins} className={button}>
                    Print the PIN list
                  </button>
                )}
                <button type="button" onClick={downloadResults} className={ghost}>
                  Download the results
                </button>
                <button type="button" onClick={onClose} className={ghost}>
                  Done
                </button>
              </div>
              <p className="text-[11.5px] text-ink-muted">
                Keep the PIN list and the parents&apos; temporary passwords safe: they aren&apos;t shown again. A PIN can be
                changed from the student&apos;s row below, and a parent&apos;s password reset from Parents.
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
