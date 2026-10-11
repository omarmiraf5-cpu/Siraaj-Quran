import { monthEnd } from "@/lib/finance";

// What a family owes, seen from one month: what's still unpaid on charges
// from before it (the old balance), the month's own charges, and the two
// together (the outstanding balance). Charges due after the month aren't
// owed yet; they're counted as upcoming.

export interface FeeLike {
  studentId: string;
  amountDue: number;
  amountPaid: number;
  dueDate: string; // YYYY-MM-DD
}

export interface Balance {
  /** Unpaid on charges due before the month. */
  old: number;
  /** Charged for the month (due within it). */
  monthBilled: number;
  /** Paid on the month's charges. */
  monthPaid: number;
  /** Still unpaid on the month's charges. */
  monthOwed: number;
  /** Old balance plus what's owed for the month. */
  outstanding: number;
  /** Unpaid on charges due after the month. */
  upcoming: number;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const owed = (f: FeeLike) => Math.max(0, f.amountDue - f.amountPaid);

/** The balance of these charges seen from `month` (YYYY-MM-01). */
export function balanceFor(fees: FeeLike[], month: string): Balance {
  const end = monthEnd(month);
  let old = 0, monthBilled = 0, monthPaid = 0, monthOwed = 0, upcoming = 0;
  for (const f of fees) {
    if (f.dueDate < month) old += owed(f);
    else if (f.dueDate <= end) {
      monthBilled += f.amountDue;
      monthPaid += Math.min(f.amountPaid, f.amountDue);
      monthOwed += owed(f);
    } else upcoming += owed(f);
  }
  return {
    old: cents(old),
    monthBilled: cents(monthBilled),
    monthPaid: cents(monthPaid),
    monthOwed: cents(monthOwed),
    outstanding: cents(old + monthOwed),
    upcoming: cents(upcoming),
  };
}

/** Each student's balance, those owing most first; students with no charges left out. */
export function balancesByStudent(fees: FeeLike[], month: string): Array<{ studentId: string } & Balance> {
  const by = new Map<string, FeeLike[]>();
  for (const f of fees) (by.get(f.studentId) ?? by.set(f.studentId, []).get(f.studentId)!).push(f);
  return [...by.entries()]
    .map(([studentId, theirs]) => ({ studentId, ...balanceFor(theirs, month) }))
    .sort((a, b) => b.outstanding - a.outstanding);
}
