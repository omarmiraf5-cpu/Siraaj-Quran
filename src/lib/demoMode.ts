// Whether this deployment is the showcase one. It gates two things on the
// login screen: the tap-to-auto-fill sample credentials, and — more
// importantly — whether those credentials are accepted as a sign-in at
// all. Without the second half the samples would still be working logins
// on a real school's site for anyone who guessed them.
//
// Off unless a deployment opts in, so production is safe by default; the
// showcase deployment sets NEXT_PUBLIC_SHOW_DEMO=true in its own Vercel
// environment variables. Written as a plain static expression because
// Next.js only inlines NEXT_PUBLIC_* when it can see the whole reference,
// so each deployment bakes in its own answer at build time.
//
// Note this does not strip the sample roster (students, teachers, the
// notice board) from the bundle — the whole app falls back to that data
// whenever there's no signed-in session, so it ships either way. The line
// this draws is that none of it can be signed into on production.
export const SHOW_DEMO_LOGINS = process.env.NEXT_PUBLIC_SHOW_DEMO === "true";
