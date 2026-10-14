import { dateLocale } from "@/lib/i18n/current";
import { labels, phrase } from "@/lib/i18n/phrases";

// The office's money besides fees: salaries and expenses (schema.sql,
// "Salaries and expenses"). Shared by the Payments page's two tabs.

export type PayMethod = "cash" | "bank" | "e_transfer" | "cheque" | "card" | "other";

export const PAY_METHOD_LABELS: Record<PayMethod, string> = labels({
  cash: "Cash",
  bank: "Bank transfer",
  e_transfer: "E-transfer",
  cheque: "Cheque",
  card: "Card",
  other: "Other",
});
/** How a salary can be paid; a card is for expenses only. */
export const SALARY_METHODS: PayMethod[] = ["cash", "bank", "e_transfer", "cheque", "other"];
export const EXPENSE_METHODS: PayMethod[] = ["cash", "card", "bank", "e_transfer", "cheque", "other"];

export type ExpenseCategory = "rent" | "utilities" | "supplies" | "food" | "transport" | "maintenance" | "events" | "other";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = labels({
  rent: "Rent",
  utilities: "Utilities",
  supplies: "Books & supplies",
  food: "Food",
  transport: "Transport",
  maintenance: "Maintenance",
  events: "Events",
  other: "Other",
});
export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export interface SalaryPayment {
  id: string;
  staffId: string | null;
  payeeName: string;
  payMonth: string; // YYYY-MM-01
  amount: number;
  paidOn: string; // YYYY-MM-DD
  method: PayMethod;
  note: string | null;
}

export interface Expense {
  id: string;
  spentOn: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  paidTo: string | null;
  method: PayMethod;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Today, on this device's calendar, as YYYY-MM-DD. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The first day of a date's month. */
export const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;

/** A month moved back or forward. */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** The last day of a month, for "spent within it". */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;
}

/** "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(dateLocale("en-CA"), { month: "long", year: "numeric" });
}

/** "30 Oct". */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(dateLocale("en-GB"), { day: "numeric", month: "short" });
}

export const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/** An amount typed in a form: a positive number with at most two decimals, or null. */
export function parseAmount(text: string): number | null {
  const n = Number(String(text).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) return null;
  return Math.round(n * 100) / 100;
}

/** Why the Salaries or Expenses tab can't load, from the database's answer. */
export function financeProblem(error: { code?: string; message?: string }, what: "Salaries" | "Expenses"): string {
  const message = error.message ?? "";
  if (["PGRST205", "42P01"].includes(error.code ?? "") || /does not exist|schema cache/i.test(message)) {
    return phrase(`${what} need the salaries and expenses update run in Supabase first (mydiiwaan-update-11.sql).`);
  }
  if (error.code === "42501" || /permission denied/i.test(message)) {
    return `${what} can't be read yet: the database hasn't given MyDiiwaan access to its new tables (${message}). Run the access fix in Supabase.`;
  }
  return what === "Salaries"
    ? phrase("Couldn't load salaries: {message}.", { message: message || phrase("please try again") })
    : phrase("Couldn't load expenses: {message}.", { message: message || phrase("please try again") });
}
