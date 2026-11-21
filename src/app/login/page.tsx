"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/components/LanguageProvider";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { SHOW_DEMO_LOGINS } from "@/lib/demoMode";
import type { Role } from "@/lib/types";
import { homeOf, mayOpen } from "@/lib/portalAccess";
import { safeNextPath } from "@/lib/safeNextPath";
import { ByLanguage } from "@/components/ByLanguage";
import { Capacitor } from "@capacitor/core";
import { gradeLabel } from "@/lib/grades";

// Shown once Google has been switched on in Supabase and this is set on the
// deployment, so the button never appears before it can work.
const GOOGLE_SIGNIN = process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "true";

const ROLES: { key: Role; labelKey: string; portalKey: string }[] = [
  { key: "parent",  labelKey: "role.parent",  portalKey: "login.portal.parent"  },
  { key: "teacher", labelKey: "role.teacher", portalKey: "login.portal.teacher" },
  { key: "student", labelKey: "role.student", portalKey: "login.portal.student" },
  { key: "admin",   labelKey: "role.admin",   portalKey: "login.portal.admin"   },
];

const DAILY_REFLECTIONS = [
  {
    arabic: "«طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ»",
    english: "Seeking knowledge is an obligation upon every Muslim.",
    source: "Prophet Muhammad ﷺ",
  },
  {
    arabic: "«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ»",
    english: "Whoever takes a path seeking knowledge, Allah makes easy for him a path to Paradise.",
    source: "Prophet Muhammad ﷺ",
  },
  {
    arabic: "﴿وَقُل رَّبِّ زِدْنِي عِلْمًا﴾",
    english: "And say: My Lord, increase me in knowledge.",
    source: "Qur'an 20:114",
  },
  {
    arabic: "«الْعِلْمُ حَيَاةُ الْقُلُوبِ»",
    english: "Knowledge is the life of hearts.",
    source: "Ali ibn Abi Talib رضي الله عنه",
  },
  {
    arabic: "«مِدَادُ الْعُلَمَاءِ أَفْضَلُ مِنْ دِمَاءِ الشُّهَدَاءِ»",
    english: "The ink of scholars is more virtuous than the blood of martyrs.",
    source: "Ibn Abd al-Barr",
  },
  {
    arabic: "«خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ»",
    english: "The best among you are those who learn the Qur'an and teach it.",
    source: "Prophet Muhammad ﷺ",
  },
  {
    arabic: "«الْعِلْمُ نُورٌ يَقْذِفُهُ اللهُ فِي قَلْبِ مَنْ يَشَاءُ»",
    english: "Knowledge is a light that Allah casts into the heart of whomever He wills.",
    source: "Imam Malik رحمه الله",
  },
];

const STUDENT_AVATARS = [
  { id: "A", color: "bg-subject-purple" },
  { id: "B", color: "bg-subject-teal"   },
  { id: "C", color: "bg-subject-orange" },
  { id: "D", color: "bg-subject-blue"   },
  { id: "E", color: "bg-subject-pink"   },
];

// The school a device last signed in to, so the student tab can show its
// roster without the ?school= link — which the MyDiiwaan app never receives.
const SCHOOL_KEY = "mydiiwaan_school";

// The email typed here, handed to /forgot-password (which reads the same key).
const RESET_EMAIL_KEY = "mydiiwaan_reset_email";

// The children who've signed in on this device, most recent first, so a
// child's own tablet offers "Continue as Aisha" next time. Only their ids
// are kept, with the school they're at: the names come from the roster.
const RECENT_KEY = "mydiiwaan_recent_students";
const RECENT_MAX = 3;

function readRecent(slug: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "null");
    return saved?.school === slug && Array.isArray(saved.ids)
      ? saved.ids.filter((id: unknown): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecent(slug: string, id: string) {
  try {
    const ids = [id, ...readRecent(slug).filter((x) => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify({ school: slug, ids }));
  } catch { /* private mode */ }
}

interface RosterStudent {
  id: string;
  first_name: string;
  initials: string;
  colour: string;
  /** The halaqas they're in; none when the school hasn't placed them. */
  halaqas?: string[];
}

interface RosterHalaqa {
  id: string;
  name: string;
  grade: number | null;
  campus: string | null;
  teacher: string | null;
  schedule: string | null;
}

// Children in no halaqa yet, gathered under a card of their own.
const NO_HALAQA = "none";

// Past this many names, the first screen also offers to type one.
const SEARCH_FROM = 20;

const HALAQA_COLOURS = ["bg-subject-teal", "bg-subject-purple", "bg-subject-orange", "bg-subject-blue", "bg-subject-pink"];

/** "Aisha" from "Aisha M.", for saying hello. */
const firstWord = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** A name without accents or capitals, to match what a child types. */
const fold = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** "Grade 3 · Halaqa A", or just "Halaqa A" in a Qur'an school. */
const halaqaHeading = (h: RosterHalaqa) =>
  [h.campus, h.grade !== null ? gradeLabel(h.grade) : null, h.name].filter(Boolean).join(" · ");

/** Who teaches it and when: "Ms. Farah · Sat–Sun 10:00". */
const halaqaDetails = (h: RosterHalaqa) => [h.teacher, h.schedule].filter(Boolean).join(" · ");

export default function LoginPage() {
  const { tr } = useLanguage();
  const router   = useRouter();
  const supabase = createClient();
  const { t }    = useLanguage();
  // Google refuses to sign anyone in from inside an app's own web view.
  const [native, setNative] = useState(false);
  useEffect(() => { setNative(Capacitor.isNativePlatform()); }, []);

  const [role,            setRole]            = useState<Role>("parent");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [error,           setError]           = useState<string | null>(null);
  const [loading,         setLoading]         = useState(false);
  const [selectedAvatar,  setSelectedAvatar]  = useState<string | null>(null);
  const [pin,             setPin]             = useState("");

  // A child's school comes from the link the school hands out
  // (/login?school=their-slug). Without one there is no roster to show, so
  // the student tab falls back to the demo avatars.
  const [roster,          setRoster]          = useState<RosterStudent[] | null>(null);
  const [schoolName,      setSchoolName]      = useState<string | null>(null);
  const [studentId,       setStudentId]       = useState<string | null>(null);

  // The school whose names are showing. Remembered on this device only
  // once a student has signed in from it (see the PIN pad below).
  const [rosterSlug,      setRosterSlug]      = useState<string | null>(null);
  // A big school's names come a halaqa at a time: the child picks their
  // class first, or types their name.
  const [halaqas,         setHalaqas]         = useState<RosterHalaqa[]>([]);
  const [halaqaId,        setHalaqaId]        = useState<string | null>(null);
  const [nameQuery,       setNameQuery]       = useState("");
  const [recent,          setRecent]          = useState<RosterStudent[]>([]);
  // Bumped by each PIN that doesn't work, to give the dots a little shake.
  const [shake,           setShake]           = useState(0);
  const [schoolCode,      setSchoolCode]      = useState("");
  const [schoolLookup,    setSchoolLookup]    = useState<"idle" | "loading" | "notFound">("idle");

  const loadRoster = useCallback(async (slug: string) => {
    const r = await fetch(`/api/student-roster?school=${encodeURIComponent(slug)}`);
    if (!r.ok) return false;
    const data = await r.json();
    const students: RosterStudent[] = data.students ?? [];
    setRoster(students);
    setHalaqas(data.halaqas ?? []);
    setHalaqaId(null);
    setNameQuery("");
    setSchoolName(data.school?.name ?? null);
    setRosterSlug(slug);
    // Whoever has signed in on this device before, if they're still here.
    setRecent(
      readRecent(slug)
        .map((id) => students.find((st) => st.id === id))
        .filter((st): st is RosterStudent => !!st)
    );
    return true;
  }, []);

  // The school from the link, or else the one this device last used.
  useEffect(() => {
    let slug = new URLSearchParams(window.location.search).get("school");
    if (!slug) {
      try { slug = localStorage.getItem(SCHOOL_KEY); } catch { /* private mode */ }
    }
    if (!slug) return;
    // A school's link is the one handed to its students, and a device only
    // remembers a school once a student has signed in on it: either way it's
    // a child who's here, so open on the Student tab with their names.
    setRole("student");
    loadRoster(slug).catch(() => {
      /* No roster: the student tab explains how to find the school. */
    });
  }, [loadRoster]);

  // Where to go once signed in: the page a link asked to come back to (the
  // platform page sends its owner here with ?next=/platform), or else the
  // person's own portal. Never another role's portal: a student's login
  // asked back to a teacher's page goes to the student's own.
  const destination = (ownRole: string) => {
    const next = safeNextPath(new URLSearchParams(window.location.search).get("next"));
    return next && mayOpen(next, ownRole) ? next : homeOf(ownRole);
  };

  // Already signed in — the app reopening, or a return visit — goes straight
  // on instead of asking for the password again.
  useEffect(() => {
    let cancelled = false;
    // Sent back here by a portal that found the account switched off.
    if (new URLSearchParams(window.location.search).get("off") === "1") setError(t("welcome.accountOff"));
    // Back from Google without getting in.
    const googleBack = new URLSearchParams(window.location.search).get("google");
    if (googleBack) {
      setError(
        googleBack === "none" ? tr("That Google account isn't linked to a school here. Ask your school office to add your email, then try again.")
        : googleBack === "off" ? t("welcome.accountOff")
        : googleBack === "student" ? tr("Students sign in with their PIN.")
        : tr("Google sign-in didn't work. Please try again, or use your password.")
      );
    }
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      const { data: profile } = await supabase.from("profiles").select("role, active").eq("id", user.id).single();
      if (profile?.active === false) {
        await supabase.auth.signOut().catch(() => {});
        if (!cancelled) setError(t("welcome.accountOff"));
        return;
      }
      if (profile?.role && profile.role !== "student") forgetRememberedSchool();
      if (user.user_metadata?.must_change_password) { router.replace("/change-password"); return; }
      if (!cancelled && profile?.role) router.replace(destination(profile.role));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const findSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = schoolCode.trim().toLowerCase().replace(/\s+/g, "-");
    if (!code) return;
    setSchoolLookup("loading");
    const found = await loadRoster(code).catch(() => false);
    setSchoolLookup(found ? "idle" : "notFound");
  };

  const forgetSchool = () => {
    try { localStorage.removeItem(SCHOOL_KEY); } catch { /* private mode */ }
    setRoster(null);
    setHalaqas([]);
    setHalaqaId(null);
    setNameQuery("");
    setRecent([]);
    setSchoolName(null);
    setStudentId(null);
    setSelectedAvatar(null);
    setPin("");
    setSchoolCode("");
  };

  // A device remembers a school's names only once a student has signed in
  // on it — a classroom tablet. A teacher's or parent's own phone never
  // shows children's names to whoever picks it up: signing in with an
  // email forgets any school it had remembered.
  const rememberSchool = () => {
    if (!rosterSlug) return;
    try { localStorage.setItem(SCHOOL_KEY, rosterSlug); } catch { /* private mode */ }
    if (studentId) writeRecent(rosterSlug, studentId);
  };
  const forgetRememberedSchool = () => {
    try {
      localStorage.removeItem(SCHOOL_KEY);
      localStorage.removeItem(RECENT_KEY);
    } catch { /* private mode */ }
  };

  // A name tapped opens the PIN screen for that child; "Not you?" closes it.
  const chooseStudent = (id: string) => {
    setStudentId(id);
    setSelectedAvatar(id);
    setPin("");
    setError(null);
  };
  const closePin = () => {
    setStudentId(null);
    setSelectedAvatar(null);
    setPin("");
    setError(null);
  };

  const googleSignIn = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (error) setError(tr("Google sign-in didn't work. Please try again, or use your password."));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();
    // Only the showcase deployment accepts the sample logins. Everywhere
    // else they fall straight through to Supabase and fail like any other
    // wrong password — otherwise the sample credentials would quietly be
    // working accounts on a real school's site.
    const demoAccount = SHOW_DEMO_LOGINS
      ? Object.values(DEMO_ACCOUNTS).find(
          (a) => "email" in a && a.email === trimmedEmail && "password" in a && a.password === trimmedPass
        )
      : undefined;
    if (demoAccount) {
      localStorage.setItem("demo_user", JSON.stringify(demoAccount));
      document.cookie = "demo_mode=true; path=/; max-age=86400; SameSite=Lax";
      router.push(`/${demoAccount.role}`);
      return;
    }

    // The trimmed values, not the raw fields: a temporary password arrives
    // by copy and paste often enough to pick up a trailing space, and a
    // phone keyboard will capitalise the first letter of an email address
    // on its own. Both failed here as "invalid email or password".
    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPass,
    });
    if (error) {
      // Supabase refuses an account the school office has switched off.
      const switchedOff = error.code === "user_banned" || /banned/i.test(error.message);
      setError(t(switchedOff ? "welcome.accountOff" : "login.invalidCredentials"));
      setLoading(false);
      return;
    }
    forgetRememberedSchool();
    // Their own portal (or the page the link asked for), whichever tab
    // happened to be selected.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, school_id, active")
      .eq("id", data.user?.id ?? "")
      .single();
    if (profile?.active === false) {
      await supabase.auth.signOut().catch(() => {});
      setError(t("welcome.accountOff"));
      setLoading(false);
      return;
    }
    if (data.user?.user_metadata?.must_change_password) {
      router.push("/change-password");
      return;
    }
    router.push(destination(profile?.role ?? role));
  };

  // Appending through the updater rather than off the rendered value: a
  // child hammering the keypad can land two taps inside one render, and
  // reading `pin` directly would drop the second one.
  const handlePin = (digit: string) => {
    setError(null);
    setPin((current) => (current.length >= 4 ? current : current + digit));
  };

  // The fourth digit is what submits, so the attempt hangs off the PIN
  // itself rather than off the tap that completed it.
  useEffect(() => {
    if (pin.length !== 4) return;

    // A real roster means a real account behind the PIN; without one this is
    // the demo, where a single PIN opens the sample student.
    if (roster && studentId) {
      setLoading(true);
      // The PIN is checked by the server, which counts wrong ones; a right
      // one comes back with what this device signs in with.
      (async () => {
        const res = await fetch("/api/student-signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId, pin }),
        }).catch(() => null);
        const body = res ? await res.json().catch(() => ({})) : {};
        if (!res || !res.ok) {
          setLoading(false);
          setError(
            !res
              ? t("login.pinOffline")
              : res.status === 429 && typeof body.locked_minutes === "number"
                ? t("login.pinResting").replace("{minutes}", String(body.locked_minutes ?? 15))
                : res.status === 429 || res.status >= 500
                  ? t("login.pinBusy")
                  : body.code === "not_ready"
                    ? t("login.pinNotReady")
                    : typeof body.tries_left === "number" && body.tries_left <= 2
                      ? t("login.pinTriesLeft").replace("{n}", String(body.tries_left))
                      : t("login.pinDidntWork")
          );
          setShake((n) => n + 1);
          setPin("");
          return;
        }
        // The right PIN, then this device signs in. Whole classrooms signing
        // in on one school connection can be told to slow down (429), which
        // is not a wrong PIN: it's tried again once or twice before saying so.
        let signedIn = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
        for (let attempt = 0; signedIn.error && attempt < 2 && (signedIn.error.status === 429 || signedIn.error.status === undefined || signedIn.error.status >= 500); attempt++) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          signedIn = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
        }
        const { error } = signedIn;
        setLoading(false);
        if (error) {
          console.error("Student sign-in failed after a right PIN:", error.status, error.message);
          setError(error.status === 429 ? t("login.pinBusy") : error.status === undefined ? t("login.pinOffline") : t("login.pinNotReady"));
          setShake((n) => n + 1);
          setPin("");
          return;
        }
        rememberSchool();
        router.push("/student");
      })();
      return;
    }

    if (SHOW_DEMO_LOGINS && pin === DEMO_ACCOUNTS.student.pin) {
      localStorage.setItem("demo_user", JSON.stringify(DEMO_ACCOUNTS.student));
      document.cookie = "demo_mode=true; path=/; max-age=86400; SameSite=Lax";
      const timer = setTimeout(() => router.push("/student"), 300);
      return () => clearTimeout(timer);
    }

    setError(t("login.wrongPin"));
    setShake((n) => n + 1);
    setPin("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, roster, studentId]);

  // The PIN screen covers the page: it doesn't scroll behind it, and a
  // keyboard can type the PIN, rub out a digit, or go back with Escape.
  const pinOpen = role === "student" && selectedAvatar !== null;
  useEffect(() => {
    if (!pinOpen) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) handlePin(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") closePin();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinOpen]);

  // The student tab's lists.
  const unplaced = (roster ?? []).filter((st) => !st.halaqas || st.halaqas.length === 0);
  // One halaqa with everyone in it leaves nothing to choose: its names show straight away.
  const onlyHalaqa = halaqas.length === 1 && unplaced.length === 0 ? halaqas[0].id : null;
  const openHalaqa = halaqaId ?? onlyHalaqa;
  const halaqaById = new Map(halaqas.map((h) => [h.id, h]));
  const childrenOf = (id: string) =>
    (roster ?? []).filter((st) => (id === NO_HALAQA ? !st.halaqas?.length : st.halaqas?.includes(id)));
  const query = fold(nameQuery.trim());
  const found = query
    ? (roster ?? [])
        .filter((st) => fold(st.first_name).includes(query))
        .sort((a, b) => Number(!fold(a.first_name).startsWith(query)) - Number(!fold(b.first_name).startsWith(query)))
    : [];
  const halaqaOfChild = (st: RosterStudent) => {
    const h = st.halaqas?.length ? halaqaById.get(st.halaqas[0]) : undefined;
    return h ? halaqaHeading(h) : null;
  };

  const nameButton = (st: RosterStudent, note?: string | null) => (
    <button
      key={st.id}
      type="button"
      onClick={() => chooseStudent(st.id)}
      className="flex flex-col items-center gap-2 rounded-card bg-white/[0.08] border border-white/10 px-1.5 py-3 hover:bg-white/15 active:scale-95 transition-all"
    >
      <span className={`w-14 h-14 rounded-full ${st.colour} text-white font-bold text-lg flex items-center justify-center shadow-dark`}>
        {st.initials}
      </span>
      <span className="w-full text-center text-[14px] leading-tight font-semibold text-white break-words">{st.first_name}</span>
      {note && <span className="w-full text-center text-[11px] leading-tight text-white/55 truncate">{note}</span>}
    </button>
  );

  return (
    <div className="relative min-h-screen login-navy flex items-center justify-center overflow-hidden">
      {/* Ambient texture */}
      <div className="absolute inset-0 pattern-lattice pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/25 pointer-events-none" />

      {/* Dark mode + language toggles — top corner (end side, so it swaps
          with the reading direction rather than colliding with the role
          switcher's mirrored position under Arabic) */}
      <div className="fixed top-3 end-3 z-50 flex items-center gap-1.5">
        <LanguageToggle variant="pill" className="bg-white/10 text-white/70 hover:bg-white/20" />
        <ThemeToggle variant="pill" className="bg-white/10 text-white/70 hover:bg-white/20" />
      </div>

      <div className="relative w-full max-w-6xl flex flex-col md:flex-row items-center md:items-stretch gap-4 md:gap-0 px-6 py-10 md:py-14">

      {/* ── LEFT PANEL — hidden on mobile ── */}
      <div className="hidden md:flex flex-col items-center justify-center md:w-1/2 px-4 md:pe-10 py-6">

        {/* Logo */}
        <div className="w-32 h-32 rounded-2xl overflow-hidden ring-1 ring-brand-gold/60 shadow-dark mb-4 flex-shrink-0">
          <Image src="/crest.jpg" alt={tr("MyDiiwaan crest")} width={128} height={128} className="object-cover w-full h-full" />
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-bold tracking-tight text-center">
          <span className="text-white">My</span>
          <span className="gold-foil">Diiwaan</span>
        </h1>
        <p className="font-calligraphy text-3xl text-brand-gold-light leading-none mt-2" dir="rtl" lang="ar">
          ديواني
        </p>
        <p className="font-serif text-white/70 text-[13px] tracking-wide mt-3 text-center">
          {t("login.tagline")}
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-sm my-6">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-brand-gold/40" />
          <span className="text-brand-gold/60 text-sm">✦</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-brand-gold/40" />
        </div>

        {/* Quranic Verse */}
        <div className="w-full max-w-sm text-center space-y-2">
          <p className="font-calligraphy text-[26px] text-brand-gold-light leading-[2.1]" dir="rtl" lang="ar">
            ﴿اقْرَأْ وَرَبُّكَ الْأَكْرَمُ ۝ الَّذِي عَلَّمَ بِالْقَلَمِ ۝ عَلَّمَ الْإِنْسَانَ مَا لَمْ يَعْلَمْ﴾
          </p>
          <p className="text-white/45 text-xs font-arabic" dir="rtl" lang="ar">[العلق: ٣–٥]</p>
          <ByLanguage
            en={
              <p className="font-serif text-white/80 text-[15px] leading-relaxed pt-1" dir="ltr">
                “Read, and your Lord is the Most Generous — Who taught by the pen — taught man what he knew not.”
              </p>
            }
            ar={null}
          />
        </div>

        {/* Abu Hayyan Quote */}
        <div className="w-full max-w-sm mt-5 backdrop-blur-md bg-white/[0.06] border border-white/15 rounded-card-lg px-5 py-4 space-y-2.5 shadow-dark">
          <p className="font-arabic text-[15px] text-white/85 leading-loose text-right" dir="rtl" lang="ar">
            قَالَ أَبُو حَيَّانَ الأَنْدَلُسِيُّ فِي البَحْرِ المُحِيطِ:
            «وَلَيْسَ وَرَاءَ التَّكَرُّمِ بِإِفَادَةِ الْفَوَائِدِ الْعِلْمِيَّةِ تَكَرُّمٌ، حَيْثُ قَالَ: ﴿الأَكْرَمُ الَّذِي عَلَّمَ بِالْقَلَمِ عَلَّمَ الإِنْسَانَ مَا لَمْ يَعْلَمْ﴾، فَدَلَّ عَلَى كَمَالِ كَرَمِهِ بِأَنَّ عَلَّمَ عِبَادَهُ مَا لَمْ يَعْلَمُوا، وَنَقَلَهُمْ مِنْ ظُلْمَةِ الْجَهْلِ إِلَى نُورِ الْعِلْمِ»
          </p>
          <ByLanguage
            en={
              <p className="font-serif text-white/70 text-[13px] leading-relaxed border-t border-white/15 pt-2.5" dir="ltr">
                “There is no generosity beyond the generosity of imparting knowledge — for He said: ﹛the Most Generous, Who taught by the pen, taught man what he knew not﹜ — indicating the perfection of His generosity in teaching His servants what they knew not, and transferring them from the darkness of ignorance to the light of knowledge.”
                <span className="block not-italic text-brand-gold-light/70 mt-1.5 text-xs tracking-wide">— Abu Ḥayyān al-Andalusī, Al-Baḥr al-Muḥīṭ</span>
              </p>
            }
            ar={null}
          />
        </div>
      </div>

      {/* Vertical divider between panels — desktop only */}
      <div className="hidden md:block w-px bg-gradient-to-b from-transparent via-brand-gold/25 to-transparent mx-2" />

      {/* ── RIGHT PANEL — Login Form ── */}
      <div className="flex flex-col items-center justify-center w-full md:w-1/2 px-2 md:ps-10 py-4">

        {/* Mobile-only compact header — smaller still on the student tab,
            where a child's halaqa or name should be the first thing seen */}
        {role === "student" ? (
          <div className="flex md:hidden items-center gap-2.5 mb-4 mt-1">
            <div className="w-11 h-11 rounded-xl overflow-hidden ring-1 ring-brand-gold/60 shadow-dark">
              <Image src="/crest.jpg" alt="MyDiiwaan" width={44} height={44} className="object-cover w-full h-full" />
            </div>
            <p className="font-display text-xl font-bold tracking-tight">
              <span className="text-white">My</span>
              <span className="gold-foil">Diiwaan</span>
            </p>
          </div>
        ) : (
        <div className="flex md:hidden flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden ring-1 ring-brand-gold/60 shadow-dark mb-2">
            <Image src="/crest.jpg" alt="MyDiiwaan" width={80} height={80} className="object-cover w-full h-full" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-center">
            <span className="text-white">My</span>
            <span className="gold-foil">Diiwaan</span>
          </h1>
          <p className="font-calligraphy text-2xl text-brand-gold-light leading-none mt-1.5" dir="rtl" lang="ar">ديواني</p>
        </div>
        )}

        {/* Daily reflection — not on the student tab, where a child's
            names come first */}
        {role !== "student" && (() => {
          const r = DAILY_REFLECTIONS[new Date().getDay()];
          return (
            <div className="w-full max-w-sm mb-6 text-center space-y-2">
              <p className="font-display text-emerald-400 text-sm uppercase tracking-[0.2em] font-bold">
                {t("login.dailyReflection")}
              </p>
              <p
                className="font-calligraphy text-[30px] text-brand-gold-light leading-[2.1]"
                dir="rtl" lang="ar"
              >
                {r.arabic}
              </p>
              <ByLanguage
                en={
                  <p className="font-serif text-white/85 text-[15px] leading-relaxed" dir="ltr">
                    &ldquo;{r.english}&rdquo;
                  </p>
                }
                ar={null}
              />
              <p className="text-white/50 text-xs tracking-wide">— {tr(r.source)}</p>
            </div>
          );
        })()}

        {/* Role switcher */}
        <div className="flex rounded-pill backdrop-blur-md bg-white/10 border border-white/10 p-1 mb-5 gap-1 shadow-dark">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => { setRole(r.key); setPin(""); setError(null); }}
              className={`px-3 min-[380px]:px-4 py-2 rounded-pill text-[13px] min-[380px]:text-sm font-semibold transition-all ${
                role === r.key
                  ? "bg-surface-card text-ink shadow-card"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>

        <div className={`w-full ${role === "student" ? "max-w-md" : "max-w-sm"}`}>
          {role === "student" ? (
            <div className="space-y-5">
              {roster && roster.length > 0 ? (
                <>
                  {schoolName && (
                    <p className="text-center font-display text-white text-lg font-bold leading-snug">{schoolName}</p>
                  )}

                  {openHalaqa ? (
                    // One halaqa's children, in big buttons.
                    <div className="space-y-4">
                      {!onlyHalaqa && (
                        <button
                          type="button"
                          onClick={() => setHalaqaId(null)}
                          className="inline-flex items-center gap-1.5 rounded-pill bg-white/10 hover:bg-white/20 px-3.5 py-2 text-white/85 text-[14px] font-semibold transition-colors"
                        >
                          <span aria-hidden className="rtl:rotate-180">‹</span>
                          {tr("All halaqas")}
                        </button>
                      )}
                      {(() => {
                        const h = halaqaById.get(openHalaqa);
                        const details = h ? halaqaDetails(h) : "";
                        return (
                          <div className="text-center">
                            <p className="font-display text-white text-xl font-bold leading-snug">{h ? halaqaHeading(h) : tr("Other students")}</p>
                            {details && <p className="text-white/65 text-[13px] mt-0.5">{details}</p>}
                            <p className="text-brand-gold-light text-[15px] font-semibold mt-3">{tr("Tap your name")}</p>
                          </div>
                        );
                      })()}
                      <div className="grid grid-cols-3 gap-2.5">
                        {childrenOf(openHalaqa).map((st) => nameButton(st))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Someone who's signed in on this device before. */}
                      {recent.length > 0 && !query && (
                        <div className="space-y-2">
                          {recent.map((st) => {
                            const where = halaqaOfChild(st);
                            return (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => chooseStudent(st.id)}
                                className="w-full flex items-center gap-3.5 text-start rounded-card-lg bg-brand-gold/15 border border-brand-gold/50 px-4 py-3 hover:bg-brand-gold/25 active:scale-[.98] transition-all"
                              >
                                <span className={`w-12 h-12 shrink-0 rounded-full ${st.colour} text-white font-bold flex items-center justify-center shadow-dark`}>
                                  {st.initials}
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-white font-semibold text-[17px] leading-snug">
                                    {tr("Continue as {name}", { name: firstWord(st.first_name) })}
                                  </span>
                                  <span className="block text-white/60 text-[12.5px] truncate">
                                    {[st.first_name !== firstWord(st.first_name) ? st.first_name : null, where].filter(Boolean).join(" · ") || st.first_name}
                                  </span>
                                </span>
                                <span aria-hidden className="text-brand-gold-light text-2xl rtl:rotate-180">›</span>
                              </button>
                            );
                          })}
                          <p className="text-center text-white/55 text-[12.5px] pt-1">
                            {halaqas.length > 0 ? tr("Someone else? Find your halaqa below.") : tr("Someone else? Find your name below.")}
                          </p>
                        </div>
                      )}

                      <p className="text-center text-brand-gold-light text-[15px] font-semibold">
                        {halaqas.length > 0 ? tr("Find your halaqa") : tr("Tap your name")}
                      </p>

                      {roster.length > SEARCH_FROM && (
                        <div className="relative">
                          <span className="absolute start-4 top-1/2 -translate-y-1/2 text-white/50" aria-hidden>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                          </span>
                          <input
                            type="search"
                            value={nameQuery}
                            onChange={(e) => setNameQuery(e.target.value)}
                            placeholder={tr("Type your name")}
                            aria-label={tr("Type your name")}
                            autoCapitalize="words"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="search"
                            className="w-full rounded-card bg-white/[0.08] border border-white/20 ps-11 pe-4 py-3 text-white text-[15px] placeholder-white/45 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 transition-all"
                          />
                        </div>
                      )}

                      {query ? (
                        found.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2.5">
                            {found.map((st) => nameButton(st, halaqaOfChild(st)))}
                          </div>
                        ) : (
                          <p className="text-center text-white/70 text-[14px] leading-relaxed px-4">
                            {halaqas.length > 0 ? tr("No one by that name here. Try finding your halaqa instead.") : tr("No one by that name here. Check the spelling, or ask your teacher.")}
                          </p>
                        )
                      ) : halaqas.length > 0 ? (
                        // Each halaqa as a card: its name, teacher, time and size.
                        <div className="space-y-2.5">
                          {[...halaqas, ...(unplaced.length > 0 ? [null] : [])].map((h, i) => {
                            const id = h?.id ?? NO_HALAQA;
                            const details = h ? halaqaDetails(h) : "";
                            const count = childrenOf(id).length;
                            return (
                              <button
                                key={id}
                                type="button"
                                onClick={() => { setHalaqaId(id); setNameQuery(""); }}
                                className="w-full flex items-center gap-3.5 text-start rounded-card-lg bg-white/[0.08] border border-white/15 px-4 py-3.5 hover:bg-white/15 active:scale-[.98] transition-all"
                              >
                                <span className={`w-12 h-12 shrink-0 rounded-2xl ${h ? HALAQA_COLOURS[i % HALAQA_COLOURS.length] : "bg-white/20"} text-white flex items-center justify-center shadow-dark`} aria-hidden>
                                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/></svg>
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="block text-white font-semibold text-[16px] leading-snug">{h ? halaqaHeading(h) : tr("Other students")}</span>
                                  {details && <span className="block text-white/65 text-[13px] leading-snug mt-0.5">{details}</span>}
                                  <span className="block text-brand-gold-light/80 text-[12px] mt-1">{tr("{count} student|{count} students", { count })}</span>
                                </span>
                                <span aria-hidden className="text-white/40 text-2xl rtl:rotate-180">›</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2.5">
                          {roster.map((st) => nameButton(st))}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : SHOW_DEMO_LOGINS ? (
                <div className="space-y-4">
                  <p className="text-center text-brand-gold-light text-[15px] font-semibold">{tr("Tap your name")}</p>
                  <div className="flex justify-center gap-3">
                    {STUDENT_AVATARS.map((av) => (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => { setSelectedAvatar(av.id); setPin(""); setError(null); }}
                        className={`w-14 h-14 rounded-full ${av.color} text-white font-bold text-lg flex items-center justify-center shadow-dark hover:scale-105 active:scale-95 transition-all`}
                      >
                        {av.id}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                // A child's roster only loads from the ?school= link their
                // school hands out. Showing the sample avatars here instead
                // gave a real child five strangers to choose from and a PIN
                // that could never work, with nothing explaining why.
                <form onSubmit={findSchool} className="space-y-3">
                  <p className="text-center text-white/70 text-sm leading-relaxed px-4">
                    {t("login.enterSchoolCode")}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={schoolCode}
                      onChange={(e) => { setSchoolCode(e.target.value); setSchoolLookup("idle"); }}
                      placeholder={t("login.schoolCodePlaceholder")}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      className="flex-1 min-w-0 rounded-card bg-white/10 border border-white/15 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-brand-gold/70"
                    />
                    <button
                      type="submit"
                      disabled={!schoolCode.trim() || schoolLookup === "loading"}
                      className="rounded-card bg-brand-gold text-brand-navy font-semibold px-4 disabled:opacity-50 active:scale-95 transition-all"
                    >
                      {schoolLookup === "loading" ? "…" : t("login.findSchool")}
                    </button>
                  </div>
                  {schoolLookup === "notFound" && (
                    <p className="text-center text-red-200 text-xs">{t("login.schoolNotFound")}</p>
                  )}
                </form>
              )}

              {roster && schoolName && (
                <p className="text-center">
                  <button type="button" onClick={forgetSchool} className="text-[11px] text-white/50 underline underline-offset-2 hover:text-white/80">
                    {t("login.notYourSchool")}
                  </button>
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-gold-light/85">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                </span>
                <input
                  type="email" required placeholder={t("login.emailAddress")}
                  autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full backdrop-blur-sm bg-white/[0.08] border border-white/20 rounded-card ps-11 pe-4 py-3.5 text-white placeholder-white/45 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 focus:bg-white/[0.1] transition-all"
                />
              </div>
              <div className="relative">
                <span className="absolute start-4 top-1/2 -translate-y-1/2 text-brand-gold-light/85">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </span>
                <input
                  type="password" required placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full backdrop-blur-sm bg-white/[0.08] border border-white/20 rounded-card ps-11 pe-4 py-3.5 text-white placeholder-white/45 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/30 focus:bg-white/[0.1] transition-all"
                />
              </div>

              {error && (
                <p className="text-status-error-text bg-status-error-bg rounded-card px-4 py-2.5 text-sm">
                  {error}
                </p>
              )}

              <button
                type="submit" disabled={loading}
                className="relative w-full overflow-hidden gradient-emerald text-white font-semibold py-3.5 rounded-card shadow-dark hover:opacity-95 hover:shadow-lg active:scale-[.98] transition-all disabled:opacity-60"
              >
                {loading ? t("login.signingIn") : `${t("login.signInTo")} ${t(ROLES.find((r) => r.key === role)?.portalKey ?? "")}`}
              </button>

              {GOOGLE_SIGNIN && !native && (
                <>
                  <div className="flex items-center gap-3 text-white/45 text-xs" aria-hidden="true">
                    <span className="flex-1 h-px bg-white/15" />{tr("or")}<span className="flex-1 h-px bg-white/15" />
                  </div>
                  <button
                    type="button"
                    onClick={googleSignIn}
                    className="w-full flex items-center justify-center gap-3 bg-white text-[#1f1f1f] font-semibold py-3.5 rounded-card hover:bg-white/95 active:scale-[.98] transition-all"
                  >
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
                    {tr("Continue with Google")}
                  </button>
                </>
              )}

              {/* Hands over whatever email is already typed, so it's there
                  waiting on the reset page — through sessionStorage rather
                  than the URL, which would carry it into server logs. */}
              <Link
                href="/forgot-password"
                onClick={() => {
                  try { sessionStorage.setItem(RESET_EMAIL_KEY, email.trim()); } catch { /* private mode */ }
                }}
                className="block text-center text-white/65 hover:text-white text-xs font-semibold underline-offset-2 hover:underline transition-colors"
              >
                {t("login.forgotPassword")}
              </Link>

              {SHOW_DEMO_LOGINS && (
                <div className="mt-4 bg-white/5 border border-white/10 rounded-card px-4 py-3">
                  <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">{t("login.demoAutofill")}</p>
                  <div className="space-y-1.5 text-xs">
                    {(["teacher", "parent", "admin"] as const).map((key) => {
                      const acct = DEMO_ACCOUNTS[key];
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => { setEmail(acct.email); setPassword(acct.password); setRole(acct.role); setError(null); }}
                          className="w-full text-start px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition text-white/50 hover:text-white/80"
                        >
                          <span className="text-white/70">{t(`role.${key}`)}:</span> {acct.email} / {acct.password}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </form>
          )}

          <p className="mt-6 text-center text-[11.5px] text-white/40">
            <Link href="/privacy" className="hover:text-white/70">{t("common.privacy")}</Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="hover:text-white/70">{t("common.terms")}</Link>
            <span className="mx-2">·</span>
            <Link href="/support" className="hover:text-white/70">{t("login.help")}</Link>
          </p>
        </div>
      </div>
      </div>

      {/* The PIN screen: the whole screen for the one child who tapped
          their name, so there's nothing to scroll past to reach it. */}
      {pinOpen && (() => {
        const who = roster?.find((st) => st.id === selectedAvatar);
        const sample = STUDENT_AVATARS.find((av) => av.id === selectedAvatar);
        const name = who ? firstWord(who.first_name) : null;
        const key = "h-[3.75rem] [@media(max-height:700px)]:h-14 [@media(max-height:600px)]:h-12 md:h-20 rounded-card backdrop-blur-sm bg-white/10 border border-white/15 text-white text-2xl md:text-3xl font-semibold hover:bg-white/20 active:scale-95 active:bg-white/25 transition-all disabled:opacity-50 flex items-center justify-center";
        return (
          <div role="dialog" aria-modal="true" aria-labelledby="pin-hello" className="fixed inset-0 z-[60] login-navy overflow-y-auto">
            <div className="absolute inset-0 pattern-lattice pointer-events-none" />
            <button
              type="button"
              onClick={closePin}
              className="absolute top-3 start-3 z-10 inline-flex items-center gap-1.5 rounded-pill bg-white/10 hover:bg-white/20 px-3.5 py-2 text-white/85 text-[14px] font-semibold transition-colors"
            >
              <span aria-hidden className="rtl:rotate-180">‹</span>
              {tr("Not you? Go back")}
            </button>
            <div className="relative min-h-full flex flex-col items-center justify-center px-6 pt-16 pb-6 [@media(max-height:600px)]:pt-14 [@media(max-height:600px)]:pb-3">
              <div className="w-full max-w-[19rem] md:max-w-xl flex flex-col items-center">
                <span className={`w-20 h-20 [@media(max-height:700px)]:w-16 [@media(max-height:700px)]:h-16 [@media(max-height:600px)]:w-12 [@media(max-height:600px)]:h-12 [@media(max-height:600px)]:text-lg md:w-28 md:h-28 md:text-4xl rounded-full ${who?.colour ?? sample?.color ?? "bg-subject-purple"} text-white font-bold text-2xl flex items-center justify-center ring-4 ring-white/15 shadow-dark`}>
                  {who?.initials ?? sample?.id}
                </span>
                <h2 id="pin-hello" className="mt-3 md:mt-5 font-display text-white text-2xl md:text-4xl font-bold text-center leading-snug">
                  {name ? tr("Assalamu alaikum, {name}!", { name }) : tr("Assalamu alaikum!")}
                </h2>
                <p className="mt-1 md:mt-2 text-white/70 text-[15px] md:text-lg text-center">{tr("Type your 4-number PIN")}</p>

                <div key={shake} className={`flex justify-center gap-4 mt-5 [@media(max-height:600px)]:mt-3 ${shake ? "animate-pin-shake" : ""}`} aria-hidden>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 md:w-6 md:h-6 rounded-full transition-all ${
                        i < pin.length ? "bg-brand-gold scale-110" : error ? "bg-red-300/40" : "bg-white/25"
                      }`}
                    />
                  ))}
                </div>
                {/* A PIN that didn't work, or the pad resting after too
                    many: said here, by the dots. */}
                <div className="min-h-[2.75rem] [@media(max-height:600px)]:min-h-[2.25rem] mt-2 flex items-center justify-center">
                  {error ? (
                    <p role="alert" className="text-center text-[14px] md:text-base font-semibold text-red-200 leading-snug">{error}</p>
                  ) : loading ? (
                    <p className="text-center text-[14px] text-white/70">{tr("Opening your page…")}</p>
                  ) : null}
                </div>

                {/* Laid out like a phone's keypad in every language: 1 2 3
                    along the top, even when the page reads right to left. */}
                <div dir="ltr" className="grid grid-cols-3 gap-3 w-full md:max-w-[25rem]">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                    <button key={d} type="button" disabled={loading} onClick={() => handlePin(String(d))} className={key}>
                      {d}
                    </button>
                  ))}
                  <div />
                  <button type="button" disabled={loading} onClick={() => handlePin("0")} className={key}>
                    0
                  </button>
                  <button type="button" disabled={loading} onClick={() => setPin((p) => p.slice(0, -1))} aria-label={tr("Delete")} className={key}>
                    ⌫
                  </button>
                </div>

                <p className="mt-5 [@media(max-height:600px)]:mt-3 text-center text-white/60 text-[13px] md:text-[15px]">{tr("Forgot your PIN? Ask your teacher.")}</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
