// Spreadsheets and printed sheets for the office: the results of an import
// to download, and a PIN list to hand out. Shared by the Students and
// Parents pages.

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** A CSV the office can open in Excel, saved straight to their device. */
export function download(name: string, rows: string[][]) {
  const blob = new Blob(["﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A file name from the school's: "Al Taqwa Academy PINs.csv". */
export const fileNameFor = (schoolName: string, what: string) => `${schoolName.replace(/[^\w ]+/g, "").trim() || "school"} ${what}.csv`;

/**
 * Prints each student's sign-in PIN, by halaqa, and any new parent logins'
 * temporary passwords, in a window of its own.
 */
export function printPinSheet(
  schoolName: string,
  students: Array<{ name: string; place?: string; pin?: string }>,
  parents: Array<{ email: string; temp_password?: string }> = []
) {
  const byPlace = [...students].sort((a, b) => (a.place ?? "").localeCompare(b.place ?? "") || a.name.localeCompare(b.name));
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(schoolName)} — student PINs</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%;margin-bottom:24px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f3f3}td.pin{font:600 16px ui-monospace,monospace;letter-spacing:.2em}
tr{break-inside:avoid}</style></head><body>
${
  byPlace.length
    ? `<h1>${escapeHtml(schoolName)} — student sign-in PINs</h1>
<p>Each student taps their name on the school's sign-in screen and types their PIN.</p>
<table><tr><th>Student</th><th>Halaqa</th><th>PIN</th></tr>
${byPlace.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.place ?? "")}</td><td class="pin">${escapeHtml(r.pin ?? "")}</td></tr>`).join("")}
</table>`
    : ""
}
${
  parents.length
    ? `<h1>New parent logins</h1><p>Each was emailed a link to choose a password. If it didn't reach them, they can sign in with this temporary one and will be asked to change it.</p>
<table><tr><th>Email</th><th>Temporary password</th></tr>${parents.map((p) => `<tr><td>${escapeHtml(p.email)}</td><td class="pin">${escapeHtml(p.temp_password ?? "")}</td></tr>`).join("")}</table>`
    : ""
}
</body></html>`);
  w.document.close();
  w.focus();
  w.print();
}
