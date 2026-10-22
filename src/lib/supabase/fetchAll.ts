/**
 * Every row of a query. The database's API hands back at most 1,000 rows
 * at a time and says nothing about the rest, so a query that can grow past
 * that — a school's attendance marks — is read a page at a time. The query
 * needs a stable order for the pages to line up.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

/**
 * How far back the registers and dashboards read attendance: about a term.
 * Their rates and day strips are about now, and a whole history of marks
 * grows with every school day — at a few hundred students it passes the
 * 1,000-row page within a week.
 */
export const ATTENDANCE_WINDOW_DAYS = 120;

/** The date `days` before today on this device, as YYYY-MM-DD. */
export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
}
