import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "crypto";

/**
 * Application-level encryption for yearly-plan content.
 *
 * Everything a teacher writes about a specific child — plan titles,
 * milestone descriptions, progress remarks — is encrypted here before it
 * reaches Postgres and decrypted here after it comes back. The database
 * never holds the plaintext and never holds the key, so a leaked backup, a
 * leaked service-role key, or a misconfigured RLS policy yields ciphertext
 * rather than a child's records.
 *
 * This module is server-only. `PLAN_ENCRYPTION_KEY` has no NEXT_PUBLIC_
 * prefix, so Next.js will not inline it into a client bundle, and importing
 * this file from a "use client" component fails the build rather than
 * shipping the key. That is the reason the yearly-plan pages talk to
 * /api/yearly-plans instead of querying Supabase from the browser the way
 * the rest of the portal does: the browser could fetch the rows, but it
 * could only ever see ciphertext.
 *
 * ── Envelope ─────────────────────────────────────────────────────────
 *   v1.<iv>.<tag>.<ciphertext>      (each part base64url)
 * The version prefix is what makes rotating the scheme later possible at
 * all: a v2 reader can still recognise and read v1 rows instead of having
 * to guess at an opaque blob.
 *
 * ── Additional authenticated data ────────────────────────────────────
 * Every field is sealed against a context string naming the table, the row
 * id and the column — "yearly_plans:<uuid>:title_enc". GCM verifies it on
 * decrypt, so a ciphertext lifted out of one child's row and pasted into
 * another's fails to open rather than silently decrypting to the wrong
 * child's text. That is why the API routes generate row ids up front
 * instead of letting Postgres default them: the id has to exist before the
 * field can be sealed to it.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits — the size GCM is specified around.
const KEY_BYTES = 32; // AES-256.

// Defined in yearlyPlan.ts, not here: the UI has to recognise the marker
// to render it, and importing this module from a client component would
// pull node:crypto — and this file's view of the key — toward the browser.
export { UNREADABLE, readable as readableOr } from "@/lib/yearlyPlan";
import { UNREADABLE } from "@/lib/yearlyPlan";

class PlanCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanCryptoError";
  }
}

/**
 * Accepts base64, base64url or hex, because the three ways somebody will
 * actually generate a key all produce different alphabets:
 *   openssl rand -base64 32
 *   openssl rand -hex 32
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
 * Refusing two of those over an encoding detail would be a support ticket,
 * not a security measure.
 */
function parseKey(raw: string, label: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) throw new PlanCryptoError(`${label} is empty`);

  const candidates: Buffer[] = [];
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_BYTES * 2) {
    candidates.push(Buffer.from(trimmed, "hex"));
  }
  candidates.push(Buffer.from(trimmed, "base64"));
  candidates.push(Buffer.from(trimmed, "base64url"));

  const key = candidates.find((b) => b.length === KEY_BYTES);
  if (!key) {
    throw new PlanCryptoError(
      `${label} must decode to ${KEY_BYTES} bytes (got ${candidates[0]?.length ?? 0}). ` +
        `Generate one with: openssl rand -base64 32`
    );
  }
  return key;
}

// Resolved per call rather than at module load. A module-level constant is
// captured once, which in dev means editing .env.local and seeing the old
// key until the whole server restarts — and in tests means no way to set a
// key before the first import.
function currentKey(): Buffer | null {
  const raw = process.env.PLAN_ENCRYPTION_KEY;
  return raw ? parseKey(raw, "PLAN_ENCRYPTION_KEY") : null;
}

/**
 * Keys a ciphertext may have been written under, newest first. The optional
 * previous key is what makes rotation possible without a migration window:
 * set PLAN_ENCRYPTION_KEY to the new one, move the old to
 * PLAN_ENCRYPTION_KEY_PREVIOUS, and rows written under either still open.
 * Anything re-saved afterwards is written under the new key.
 */
function decryptionKeys(): Buffer[] {
  const keys: Buffer[] = [];
  const current = currentKey();
  if (current) keys.push(current);
  const previous = process.env.PLAN_ENCRYPTION_KEY_PREVIOUS;
  if (previous) keys.push(parseKey(previous, "PLAN_ENCRYPTION_KEY_PREVIOUS"));
  return keys;
}

/** Whether this deployment can store plan content at all. */
export function isEncryptionConfigured(): boolean {
  try {
    return currentKey() !== null;
  } catch {
    // A key that is set but malformed is not "configured" — better to
    // report the module as unavailable than to half-work.
    return false;
  }
}

/** The one place the context string's shape is decided. */
export function fieldContext(table: string, rowId: string, column: string): string {
  return `${table}:${rowId}:${column}`;
}

/**
 * Seals one field. `null`/`undefined`/empty stays null rather than becoming
 * an envelope around an empty string — an absent note and a note the
 * teacher deliberately cleared are the same thing here, and storing
 * ciphertext for both would mean every empty field still leaked its own
 * existence as a distinct value.
 */
export function encryptField(
  plaintext: string | null | undefined,
  context: string
): string | null {
  if (plaintext == null) return null;
  const value = String(plaintext);
  if (value === "") return null;

  const key = currentKey();
  if (!key) {
    // Fail closed. Writing the plaintext through because the key is missing
    // would be the single worst outcome available: the data lands in the
    // column that everything downstream treats as already-encrypted, and
    // nothing ever flags it again.
    throw new PlanCryptoError(
      "PLAN_ENCRYPTION_KEY is not set — refusing to store plan content unencrypted. " +
        "Generate a key with `openssl rand -base64 32` and set it in the server environment."
    );
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Opens one field. Returns null for a null column, and UNREADABLE for a
 * value that exists but cannot be opened — a row written under a key this
 * deployment no longer has, or a corrupted envelope.
 *
 * Deliberately not a throw: a single unreadable milestone note should leave
 * the rest of the plan on screen with one line marked unreadable, not blank
 * the whole page. Callers that need to distinguish it compare against
 * UNREADABLE.
 */
export function decryptField(envelope: string | null | undefined, context: string): string | null {
  if (envelope == null || envelope === "") return null;

  const parts = envelope.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return UNREADABLE;

  const [, ivB64, tagB64, ctB64] = parts;
  let iv: Buffer;
  let tag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64url");
    tag = Buffer.from(tagB64, "base64url");
    ciphertext = Buffer.from(ctB64, "base64url");
  } catch {
    return UNREADABLE;
  }
  if (iv.length !== IV_BYTES || tag.length !== 16) return UNREADABLE;

  for (const key of decryptionKeys()) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(context, "utf8"));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      // Wrong key, wrong context, or a tampered payload — GCM cannot tell
      // those apart and neither should this. Try the next key.
    }
  }
  return UNREADABLE;
}

/**
 * Self-check for the health endpoint and for startup logging: proves the
 * configured key round-trips, without printing any of it. Runs a real
 * encrypt/decrypt rather than just measuring the key's length, so a key
 * that parses to the right size but is somehow unusable still fails here.
 */
export function verifyEncryptionKey(): { ok: boolean; detail: string } {
  if (!isEncryptionConfigured()) {
    return { ok: false, detail: "PLAN_ENCRYPTION_KEY is not set or is not 32 bytes" };
  }
  try {
    const probe = "round-trip-probe";
    const context = fieldContext("selfcheck", "00000000-0000-0000-0000-000000000000", "probe");
    const sealed = encryptField(probe, context);
    const opened = decryptField(sealed, context);
    if (opened == null || opened === UNREADABLE) {
      return { ok: false, detail: "key did not round-trip" };
    }
    const a = Buffer.from(opened);
    const b = Buffer.from(probe);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, detail: "round-trip produced different bytes" };
    }
    // The context really is enforced — a probe opened under the wrong
    // context must fail, or the AAD binding is not doing its job.
    const wrongContext = fieldContext("selfcheck", "11111111-1111-1111-1111-111111111111", "probe");
    if (decryptField(sealed, wrongContext) !== UNREADABLE) {
      return { ok: false, detail: "context binding is not being enforced" };
    }
    return { ok: true, detail: "aes-256-gcm, context-bound, round-trip verified" };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "unknown failure" };
  }
}
