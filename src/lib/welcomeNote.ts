/**
 * What the office is told about a new teacher's or parent's welcome email,
 * from what /api/admin/accounts answered: "sent", or why it wasn't. Ends in
 * a space when there's anything to say, so it can sit before the next
 * sentence.
 */
export function welcomeNote(outcome: unknown): string {
  if (outcome === "sent") return "We've emailed them a link to choose their own password. ";
  if (typeof outcome === "string" && outcome) return `Their welcome email didn't send (${outcome}). `;
  return "";
}
