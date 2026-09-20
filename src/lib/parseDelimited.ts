import "server-only";
import ExcelJS from "exceljs";

/**
 * Reading a spreadsheet or CSV into rows of cells — the same parsing the
 * onboarding roster upload uses, pulled out here so a second upload
 * feature (the school calendar) doesn't hand-roll CSV quote handling a
 * second time and risk getting it subtly wrong twice.
 *
 * Not the popular "xlsx" (SheetJS) package: its npm-published build has
 * open prototype-pollution and ReDoS advisories with no fix available
 * through npm. exceljs covers .xlsx without that baggage.
 */

/** Handles quoted fields (commas/newlines/escaped quotes inside a value),
 *  which a plain String.split(",") would break on. */
export function parseCsv(text: string): string[][] {
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

export async function parseXlsx(buffer: ArrayBuffer): Promise<string[][]> {
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

export function matchColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const i = headers.findIndex((h) => pattern.test(h.trim()));
    if (i !== -1) return i;
  }
  return -1;
}
