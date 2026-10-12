import "server-only";
import { randomBytes } from "crypto";

// A student's login never has a password anyone could work out. The PIN is
// checked by this app's server (api/student-signin), which counts wrong
// guesses, and only then gives the login a fresh random password and hands
// it to the child's device to sign in with. So the PIN can't be tried
// straight against the sign-in service, round the count.

/** A password nobody knows, for a student's login. */
export const randomStudentPassword = () => `s1.${randomBytes(24).toString("base64url")}`;

/** Wrong PINs in a row before a child's PIN pad rests, and for how long. */
export const PIN_TRIES = 5;
export const PIN_REST_MINUTES = 15;
