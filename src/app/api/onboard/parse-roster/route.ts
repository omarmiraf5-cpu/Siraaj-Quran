import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import mammoth from "mammoth";

// Reads a school's existing roster out of a spreadsheet or Word document so
// an admin isn't stuck typing every student in by hand during onboarding.
// Runs before any account exists (same reasoning as /api/onboard itself),
// so it's unauthenticated — it only ever parses the file it's handed and
// returns rows, never touches the database, so there's nothing here for
// that to expose.
//
// Deliberately not using the popular "xlsx" (SheetJS) package: its
// npm-published build has open prototype-pollution and ReDoS advisories
// with no fix available through npm (SheetJS only ships the patched build
// through their own CDN). exceljs covers .xlsx without that baggage; a
// hand-rolled parser below covers .csv without any dependency at all.
// Legacy binary .xls isn't supported as a result — callers are asked to
// save as .xlsx or .csv instead.

const MAX_FILE_BYTES = 5 * 1024 * 1024; // A roster is a few hundred rows at most.

interface ParsedStudent {
  name: string;
  age: number | null;
  halaqa: string;
  // Most schools already keep a parent contact next to each child, so the
  // roster they upload can build the parent accounts too. Two siblings
  // carrying the same parent email become one parent with two children —
  // grouping happens on the client, which owns the parent list.
  parentName: string;
  parentEmail: string;
}

function matchColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const i = headers.findIndex((h) => pattern.test(h.trim()));
    if (i !== -1) return i;
  }
  return -1;
}

const NAME_PATTERNS = [/^(full[ _-]?name|student[ _-]?name|name)$/i];
const AGE_PATTERNS = [/^age$/i];
const GRADE_PATTERNS = [/^grade$/i];
const HALAQA_PATTERNS = [/^(halaqa|class|group|section)$/i];
// Ordered: the more specific header wins, so a sheet with both "Parent
// Email" and a bare "Email" column doesn't mistake the student's own
// address for the parent's.
const PARENT_NAME_PATTERNS = [
  /^(parent|guardian)[ _-]?(full[ _-]?)?name$/i,
  /^(parent|guardian|father|mother)$/i,
];
const PARENT_EMAIL_PATTERNS = [
  /^(parent|guardian)[ _-]?e[ _-]?mail( address)?$/i,
  /^e[ _-]?mail( address)?$/i,
];

function rowsToStudents(rows: string[][]): { students: ParsedStudent[]; warnings: string[] } {
  const warnings: string[] = [];
  if (rows.length === 0) return { students: [], warnings: ["The file has no rows."] };

  const headers = rows[0].map((c) => String(c ?? ""));
  const nameCol = matchColumn(headers, NAME_PATTERNS);
  const ageCol = matchColumn(headers, AGE_PATTERNS);
  const gradeCol = matchColumn(headers, GRADE_PATTERNS);
  const halaqaCol = matchColumn(headers, HALAQA_PATTERNS);
  const parentNameCol = matchColumn(headers, PARENT_NAME_PATTERNS);
  const parentEmailCol = matchColumn(headers, PARENT_EMAIL_PATTERNS);

  if (nameCol === -1) {
    const found = headers.filter(Boolean).join(", ");
    return {
      students: [],
      warnings: [`Couldn't find a "Name" column.${found ? ` Found: ${found}` : ""}`],
    };
  }

  const students: ParsedStudent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[nameCol] ?? "").trim();
    if (!name) continue;

    let age: number | null = null;
    if (ageCol !== -1) {
      const raw = Number(row[ageCol]);
      if (Number.isFinite(raw) && raw > 0) age = Math.round(raw);
    }
    if (age === null && gradeCol !== -1) {
      const raw = Number(row[gradeCol]);
      if (Number.isFinite(raw)) age = Math.round(raw) + 6;
    }

    const halaqa = halaqaCol !== -1 ? String(row[halaqaCol] ?? "").trim() : "";

    // An email is what actually creates the account, so a parent name with
    // no address behind it is dropped rather than carried forward as an
    // account nobody can sign into. A missing name falls back to the
    // child's — "Yusuf Ali's parent" reads better in a list than a blank.
    const parentEmail =
      parentEmailCol !== -1 ? String(row[parentEmailCol] ?? "").trim().toLowerCase() : "";
    const rawParentName = parentNameCol !== -1 ? String(row[parentNameCol] ?? "").trim() : "";
    const parentName = parentEmail
      ? rawParentName || `${name}'s parent`
      : "";

    students.push({ name, age, halaqa, parentName, parentEmail: parentEmail || "" });
  }

  if (ageCol === -1 && gradeCol === -1) {
    warnings.push("No \"Age\" or \"Grade\" column found — set each student's age by hand.");
  }
  if (halaqaCol === -1) {
    warnings.push("No \"Halaqa\" column found — assign each student to a halaqa by hand.");
  }
  if (parentEmailCol === -1) {
    warnings.push(
      "No \"Parent Email\" column found — add parent accounts on the next step, or later from Admin → Parents."
    );
  }

  return { students, warnings };
}

// Handles quoted fields (commas/newlines/escaped quotes inside a value),
// which a plain String.split(",") would break on.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(cell.text ?? "");
    });
    rows.push(cells);
  });
  return rows;
}

async function parseDocx(buffer: ArrayBuffer): Promise<string[][]> {
  const { value: html } = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) });
  // Word's tables come through as plain <table>/<tr>/<td> — no nested
  // tables expected in a student roster, so a small regex walk covers it
  // without pulling in a full HTML parser for this one narrow case.
  const rows: string[][] = [];
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return rows;
  const rowMatches = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const rowHtml of rowMatches) {
    const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? [];
    rows.push(cellMatches.map((c) => c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
  }
  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "That file is too large (5MB max)." }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    let rows: string[][];
    if (lowerName.endsWith(".csv")) {
      rows = parseCsv(await file.text());
    } else if (lowerName.endsWith(".xlsx")) {
      rows = await parseXlsx(await file.arrayBuffer());
    } else if (lowerName.endsWith(".docx")) {
      rows = await parseDocx(await file.arrayBuffer());
    } else {
      return NextResponse.json(
        {
          error:
            "Unsupported file type. Upload a .xlsx or .csv spreadsheet, or a .docx document with a table (legacy .xls and .doc aren't supported — save as .xlsx first).",
        },
        { status: 400 }
      );
    }

    const { students, warnings } = rowsToStudents(rows);
    if (students.length === 0) {
      return NextResponse.json(
        { error: warnings[0] || "Couldn't find any students in that file." },
        { status: 400 }
      );
    }

    return NextResponse.json({ students, warnings });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? `Couldn't read that file: ${err.message}` : "Couldn't read that file.",
      },
      { status: 400 }
    );
  }
}
