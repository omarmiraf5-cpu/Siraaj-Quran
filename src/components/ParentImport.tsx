"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { download, fileNameFor, printPinSheet } from "@/lib/sheetTools";
import { loadRoster } from "@/lib/rosterExport";

// Parents for the students a school already has, from a spreadsheet: each
// row a child's name and their parent's name and email. Read, matched to
// the roster for a look first, then sent a batch at a time — each parent's
// rows together, so one parent of three children gets one login and one
// welcome naming all three (/api/admin/import-parents).

interface SheetRow {
  child: string;
  halaqa: string;
  parentName: string;
  parentEmail: string;
}
interface RowResult {
  child: string;
  status: "linked" | "already" | "failed";
  student?: string;
  reason?: string;
  parent?: { email: string; status: "created" | "linked" | "failed"; reason?: string; temp_password?: string };
}

const BATCH = 25;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const key = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const button =
  "gradient-emerald text-white text-sm font-semibold px-4 py-2.5 rounded-2xl hover:opacity-90 active:scale-[.98] transition-all disabled:opacity-40";
const ghost =
  "text-sm font-semibold px-4 py-2.5 rounded-2xl border border-surface-border text-ink hover:bg-surface-bg-warm transition disabled:opacity-40";

const TEMPLATE = [
  ["Child's name", "Halaqa", "Parent Name", "Parent Email"],
  ["Amina Yusuf", "Halaqa A", "Hodan Ali", "hodan@example.com"],
  ["Bilal Yusuf", "Halaqa B", "Hodan Ali", "hodan@example.com"],
];

export default function ParentImport({
  students,
  onDone,
  onClose,
}: {
  students: Array<{ id: string; name: string; active?: boolean }>;
  onDone: () => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [schoolName, setSchoolName] = useState("");
  const [phase, setPhase] = useState<"pick" | "preview" | "linking" | "done">("pick");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<SheetRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);

  useEffect(() => {
    supabase
      .from("schools")
      .select("name")
      .maybeSingle()
      .then(({ data }) => setSchoolName((data?.name as string | undefined) ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The school's own students, ready for their parents to be typed in:
  // those with parents already show them, and can be left as they are.
  const [fetching, setFetching] = useState(false);
  const downloadStudents = async () => {
    setFetching(true);
    try {
      const roster = (await loadRoster(supabase)).filter((s) => s.active);
      roster.sort((a, b) => (a.halaqas[0]?.name ?? "").localeCompare(b.halaqas[0]?.name ?? "") || a.name.localeCompare(b.name));
      const name = schoolName || ((await supabase.from("schools").select("name").maybeSingle()).data?.name as string | undefined) || "";
      download(fileNameFor(name, "students for parents"), [
        TEMPLATE[0],
        ...roster.flatMap((s) => {
          const halaqa = s.halaqas.map((h) => h.name).join(", ");
          return s.parents.length > 0 ? s.parents.map((p) => [s.name, halaqa, p.name, p.email]) : [[s.name, halaqa, "", ""]];
        }),
      ]);
    } finally {
      setFetching(false);
    }
  };

  const read = async (file: File) => {
    setReading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/onboard/parse-roster", { method: "POST", body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't read that file");
      const read = ((body.students ?? []) as Array<{ name: string; halaqa: string; parentName: string; parentEmail: string }>).map((r) => ({
        child: r.name,
        halaqa: r.halaqa ?? "",
        parentName: r.parentName ?? "",
        parentEmail: r.parentEmail ?? "",
      }));
      if (read.length === 0) throw new Error("No rows found. The sheet needs a Child's name column and a Parent Email column.");
      if (!read.some((r) => r.parentEmail)) throw new Error("No Parent Email column found. Add one, with each child's parent's email.");
      setRows(read);
      setFileName(file.name);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that file");
    } finally {
      setReading(false);
    }
  };

  // What the roster says before anything is sent.
  const plan = useMemo(() => {
    const byName = new Map<string, number>();
    for (const s of students.filter((s) => s.active !== false)) byName.set(key(s.name), (byName.get(key(s.name)) ?? 0) + 1);
    const noEmail = rows.filter((r) => !EMAIL.test(key(r.parentEmail)));
    const withEmail = rows.filter((r) => EMAIL.test(key(r.parentEmail)));
    const notFound = withEmail.filter((r) => !byName.get(key(r.child)));
    const twice = withEmail.filter((r) => (byName.get(key(r.child)) ?? 0) > 1 && !r.halaqa.trim());
    const sendable = withEmail.filter((r) => !notFound.includes(r) && !twice.includes(r));
    const parents = new Set(sendable.map((r) => key(r.parentEmail))).size;
    return { noEmail, notFound, twice, sendable, parents };
  }, [rows, students]);

  const run = async () => {
    setPhase("linking");
    setProgress(0);
    const held: RowResult[] = [
      ...plan.noEmail.map((r) => ({ child: r.child, status: "failed" as const, reason: r.parentEmail ? "That isn't an email address" : "No parent email" })),
      ...plan.notFound.map((r) => ({ child: r.child, status: "failed" as const, reason: `No student called ${r.child} at the school` })),
      ...plan.twice.map((r) => ({ child: r.child, status: "failed" as const, reason: `Two or more students are called ${r.child} — add their Halaqa column to tell them apart` })),
    ];
    const out: RowResult[] = [...held];
    // Each parent's rows kept in one batch.
    const groups = new Map<string, SheetRow[]>();
    for (const r of plan.sendable) groups.set(key(r.parentEmail), [...(groups.get(key(r.parentEmail)) ?? []), r]);
    const batches: SheetRow[][] = [];
    let current: SheetRow[] = [];
    for (const group of groups.values()) {
      if (current.length > 0 && current.length + group.length > BATCH) {
        batches.push(current);
        current = [];
      }
      current.push(...group.slice(0, BATCH));
    }
    if (current.length > 0) batches.push(current);

    let sent = 0;
    for (const batch of batches) {
      let answer: RowResult[] | null = null;
      for (let attempt = 0; attempt < 2 && !answer; attempt++) {
        try {
          const res = await fetch("/api/admin/import-parents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rows: batch }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok && Array.isArray(body.results)) answer = body.results;
          else if (res.status < 500) answer = batch.map((r) => ({ child: r.child, status: "failed" as const, reason: body.error ?? "Not linked" }));
        } catch {
          // Tried again.
        }
      }
      out.push(
        ...(answer ??
          batch.map((r) => ({
            child: r.child,
            status: "failed" as const,
            reason: "That didn't get through. Import the same sheet again — parents already linked are kept.",
          })))
      );
      sent += batch.length;
      setProgress(sent);
      setResults([...out]);
    }
    setResults([...out]);
    setPhase("done");
    onDone();
  };

  const linked = results.filter((r) => r.status === "linked");
  const already = results.filter((r) => r.status === "already");
  const failed = results.filter((r) => r.status === "failed");
  const newParents = [...new Map(results.filter((r) => r.parent?.status === "created").map((r) => [r.parent!.email, r.parent!])).values()];
  const parentsLinked = new Set(results.filter((r) => r.status !== "failed").map((r) => r.parent?.email)).size;

  return (
    <section aria-label="Import parents" className="card-quiet p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Import parents from a spreadsheet</h2>
          <p className="text-[12.5px] text-ink-muted mt-1 leading-relaxed">
            For students already here. One row per child: <strong>Child&apos;s name</strong>, <strong>Parent Name</strong>,{" "}
            <strong>Parent Email</strong>, and their <strong>Halaqa</strong> if two children share a name. A parent of several children
            gets one login, and each new parent is emailed a link to choose their password. Easiest: download your students, fill in
            each parent&apos;s name and email, and choose that file.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-[13px] font-semibold text-ink-muted hover:text-ink flex-shrink-0">
          Close
        </button>
      </div>

      {phase === "pick" && (
        <div className="flex flex-wrap items-center gap-2">
          <label className={`${button} cursor-pointer`}>
            {reading ? "Reading…" : "Choose the spreadsheet"}
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
          <button type="button" onClick={downloadStudents} disabled={fetching} className={ghost}>
            {fetching ? "Getting them…" : "Download your students to fill in"}
          </button>
          <button type="button" onClick={() => download("parents template.csv", TEMPLATE)} className={ghost}>
            Download a template
          </button>
        </div>
      )}
      {error && <p className="text-[12.5px] text-status-error-text">{error}</p>}

      {phase === "preview" && (
        <div className="space-y-3">
          <p className="text-[13px] text-ink">
            <strong>{fileName}</strong>: {rows.length} row{rows.length === 1 ? "" : "s"}.{" "}
            <strong>{plan.sendable.length}</strong> child{plan.sendable.length === 1 ? "" : "ren"} found, for{" "}
            <strong>{plan.parents}</strong> parent{plan.parents === 1 ? "" : "s"}.
          </p>
          {(plan.notFound.length > 0 || plan.twice.length > 0 || plan.noEmail.length > 0) && (
            <div className="rounded-2xl border border-status-warning-text/30 bg-status-warning-bg p-3 space-y-1 text-[12.5px] text-ink">
              {plan.notFound.length > 0 && (
                <p>
                  <strong>{plan.notFound.length}</strong> not found at the school, so they won&apos;t be linked:{" "}
                  {plan.notFound.slice(0, 6).map((r) => r.child).join(", ")}
                  {plan.notFound.length > 6 ? "…" : ""}. Check the spelling matches the Students page.
                </p>
              )}
              {plan.twice.length > 0 && (
                <p>
                  <strong>{plan.twice.length}</strong> share a name with another student; add a Halaqa column to tell them apart:{" "}
                  {plan.twice.slice(0, 6).map((r) => r.child).join(", ")}
                  {plan.twice.length > 6 ? "…" : ""}.
                </p>
              )}
              {plan.noEmail.length > 0 && (
                <p>
                  <strong>{plan.noEmail.length}</strong> with no parent email, so they&apos;re skipped:{" "}
                  {plan.noEmail.slice(0, 6).map((r) => r.child).join(", ")}
                  {plan.noEmail.length > 6 ? "…" : ""}.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={run} disabled={plan.sendable.length === 0} className={button}>
              Link {plan.parents} parent{plan.parents === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={() => { setPhase("pick"); setRows([]); }} className={ghost}>
              Choose another file
            </button>
          </div>
        </div>
      )}

      {phase === "linking" && (
        <div>
          <p className="text-[13.5px] font-semibold text-ink">
            Linking parents… {progress} of {plan.sendable.length}
          </p>
          <div className="mt-2 h-2 rounded-full bg-surface-bg-warm overflow-hidden">
            <div className="h-full bg-emerald-600 transition-all" style={{ width: `${plan.sendable.length ? (progress / plan.sendable.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-3">
          <p className="text-[13.5px] text-ink">
            <strong>{linked.length}</strong> child{linked.length === 1 ? "" : "ren"} linked to <strong>{parentsLinked}</strong> parent
            {parentsLinked === 1 ? "" : "s"}
            {newParents.length > 0 && (
              <>
                , <strong>{newParents.length}</strong> new login{newParents.length === 1 ? "" : "s"} emailed
              </>
            )}
            .{already.length > 0 && <span className="text-ink-muted"> {already.length} were linked already.</span>}
          </p>
          {failed.length > 0 && (
            <div className="rounded-2xl border border-status-error-text/30 bg-status-error-bg p-3 text-[12.5px] text-ink space-y-0.5">
              <p className="font-semibold">{failed.length} not linked:</p>
              {failed.slice(0, 10).map((r, i) => (
                <p key={i}>
                  {r.child || "(no name)"} — {r.reason}
                </p>
              ))}
              {failed.length > 10 && <p>…and {failed.length - 10} more, in the spreadsheet below.</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {newParents.length > 0 && (
              <button type="button" onClick={() => printPinSheet(schoolName || "School", [], newParents)} className={button}>
                Print new parents&apos; logins
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                download(fileNameFor(schoolName, "parents import"), [
                  ["Child", "Matched to", "Result", "Problem", "Parent email", "Parent login", "Temporary password"],
                  ...results.map((r) => [
                    r.child,
                    r.student ?? "",
                    r.status,
                    r.reason ?? r.parent?.reason ?? "",
                    r.parent?.email ?? "",
                    r.parent?.status ?? "",
                    r.parent?.temp_password ?? "",
                  ]),
                ])
              }
              className={ghost}
            >
              Download the results
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
