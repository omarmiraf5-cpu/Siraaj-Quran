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
import { studentLoginEmail, studentLoginPassword } from "@/lib/studentAuth";

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

interface RosterStudent {
  id: string;
  first_name: string;
  initials: string;
  colour: string;
}

export default function LoginPage() {
  const router   = useRouter();
  const supabase = createClient();
  const { t }    = useLanguage();

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

  const [schoolCode,      setSchoolCode]      = useState("");
  const [schoolLookup,    setSchoolLookup]    = useState<"idle" | "loading" | "notFound">("idle");

  const loadRoster = useCallback(async (slug: string) => {
    const r = await fetch(`/api/student-roster?school=${encodeURIComponent(slug)}`);
    if (!r.ok) return false;
    const data = await r.json();
    setRoster(data.students ?? []);
    setSchoolName(data.school?.name ?? null);
    try { localStorage.setItem(SCHOOL_KEY, slug); } catch { /* private mode */ }
    return true;
  }, []);

  // The school from the link, or else the one this device last used.
  useEffect(() => {
    let slug = new URLSearchParams(window.location.search).get("school");
    if (!slug) {
      try { slug = localStorage.getItem(SCHOOL_KEY); } catch { /* private mode */ }
    }
    if (!slug) return;
    loadRoster(slug).catch(() => {
      /* No roster: the student tab explains how to find the school. */
    });
  }, [loadRoster]);

  // Already signed in — the app reopening, or a return visit — goes straight
  // to that person's own portal instead of asking for the password again.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return;
      if (user.user_metadata?.must_change_password) { router.replace("/change-password"); return; }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      if (!cancelled && profile?.role) router.replace(`/${profile.role}`);
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
    setSchoolName(null);
    setStudentId(null);
    setSelectedAvatar(null);
    setPin("");
    setSchoolCode("");
  };

  /** Keep this device's school, so a child using the same phone or tablet
   *  later sees their classmates' names without a link. */
  const rememberSchool = async (schoolId: string | null | undefined) => {
    if (!schoolId) return;
    const { data } = await supabase.from("schools").select("slug").eq("id", schoolId).single();
    if (data?.slug) {
      try { localStorage.setItem(SCHOOL_KEY, data.slug); } catch { /* private mode */ }
    }
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
    if (error) { setError(t("login.invalidCredentials")); setLoading(false); return; }
    if (data.user?.user_metadata?.must_change_password) {
      router.push("/change-password");
      return;
    }
    // Their own portal, whichever tab happened to be selected.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, school_id")
      .eq("id", data.user?.id ?? "")
      .single();
    rememberSchool(profile?.school_id).catch(() => {});
    router.push(`/${profile?.role ?? role}`);
  };

  // Appending through the updater rather than off the rendered value: a
  // child hammering the keypad can land two taps inside one render, and
  // reading `pin` directly would drop the second one.
  const handlePin = (digit: string) => {
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
      supabase.auth
        .signInWithPassword({
          email: studentLoginEmail(studentId),
          password: studentLoginPassword(studentId, pin),
        })
        .then(({ error }) => {
          setLoading(false);
          if (error) {
            setError(t("login.pinDidntWork"));
            setPin("");
            return;
          }
          router.push("/student");
        });
      return;
    }

    if (SHOW_DEMO_LOGINS && pin === DEMO_ACCOUNTS.student.pin) {
      localStorage.setItem("demo_user", JSON.stringify(DEMO_ACCOUNTS.student));
      document.cookie = "demo_mode=true; path=/; max-age=86400; SameSite=Lax";
      const timer = setTimeout(() => router.push("/student"), 300);
      return () => clearTimeout(timer);
    }

    setError(t("login.wrongPin"));
    setPin("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, roster, studentId]);

  return (
    <div className="relative min-h-screen gradient-navy flex items-center justify-center overflow-hidden">
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
          <Image src="/crest.jpg" alt="MyDiiwaan crest" width={128} height={128} className="object-cover w-full h-full" />
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
          <p className="font-serif text-white/80 text-[15px] leading-relaxed pt-1" dir="ltr">
            &ldquo;Read, and your Lord is the Most Generous — Who taught by the pen —
            taught man what he knew not.&rdquo;
          </p>
        </div>

        {/* Abu Hayyan Quote */}
        <div className="w-full max-w-sm mt-5 backdrop-blur-md bg-white/[0.06] border border-white/15 rounded-card-lg px-5 py-4 space-y-2.5 shadow-dark">
          <p className="font-arabic text-[15px] text-white/85 leading-loose text-right" dir="rtl" lang="ar">
            قَالَ أَبُو حَيَّانَ الأَنْدَلُسِيُّ فِي البَحْرِ المُحِيطِ:
            «وَلَيْسَ وَرَاءَ التَّكَرُّمِ بِإِفَادَةِ الْفَوَائِدِ الْعِلْمِيَّةِ تَكَرُّمٌ، حَيْثُ قَالَ: ﴿الأَكْرَمُ الَّذِي عَلَّمَ بِالْقَلَمِ عَلَّمَ الإِنْسَانَ مَا لَمْ يَعْلَمْ﴾، فَدَلَّ عَلَى كَمَالِ كَرَمِهِ بِأَنَّ عَلَّمَ عِبَادَهُ مَا لَمْ يَعْلَمُوا، وَنَقَلَهُمْ مِنْ ظُلْمَةِ الْجَهْلِ إِلَى نُورِ الْعِلْمِ»
          </p>
          <p className="font-serif text-white/70 text-[13px] leading-relaxed border-t border-white/15 pt-2.5" dir="ltr">
            &ldquo;There is no generosity beyond the generosity of imparting knowledge — for He said:
            ﹛the Most Generous, Who taught by the pen, taught man what he knew not﹜ —
            indicating the perfection of His generosity in teaching His servants what they knew not,
            and transferring them from the darkness of ignorance to the light of knowledge.&rdquo;
            <span className="block not-italic text-brand-gold-light/70 mt-1.5 text-xs tracking-wide">— Abu Ḥayyān al-Andalusī, Al-Baḥr al-Muḥīṭ</span>
          </p>
        </div>
      </div>

      {/* Vertical divider between panels — desktop only */}
      <div className="hidden md:block w-px bg-gradient-to-b from-transparent via-brand-gold/25 to-transparent mx-2" />

      {/* ── RIGHT PANEL — Login Form ── */}
      <div className="flex flex-col items-center justify-center w-full md:w-1/2 px-2 md:ps-10 py-4">

        {/* Mobile-only compact header */}
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

        {/* Daily reflection */}
        {(() => {
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
              <p className="font-serif text-white/85 text-[15px] leading-relaxed" dir="ltr">
                &ldquo;{r.english}&rdquo;
              </p>
              <p className="text-white/50 text-xs tracking-wide" dir="ltr">— {r.source}</p>
            </div>
          );
        })()}

        {/* Role switcher */}
        <div className="flex rounded-pill backdrop-blur-md bg-white/10 border border-white/10 p-1 mb-5 gap-1 shadow-dark">
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => { setRole(r.key); setPin(""); setError(null); }}
              className={`px-4 py-2 rounded-pill text-sm font-semibold transition-all ${
                role === r.key
                  ? "bg-surface-card text-ink shadow-card"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>

        <div className="w-full max-w-sm">
          {role === "student" ? (
            <div className="space-y-5">
              {schoolName && (
                <p className="text-center text-white/70 text-sm">
                  {schoolName} — {t("login.tapNameThenPin")}
                </p>
              )}

              {roster && roster.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-3">
                  {roster.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => { setStudentId(s.id); setSelectedAvatar(s.id); setPin(""); setError(null); }}
                      className={`flex flex-col items-center gap-1 transition-all ${
                        selectedAvatar === s.id ? "scale-105" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <span
                        className={`w-12 h-12 rounded-full ${s.colour} text-white font-bold text-sm flex items-center justify-center ${
                          selectedAvatar === s.id
                            ? "ring-2 ring-white ring-offset-2 ring-offset-transparent"
                            : ""
                        }`}
                      >
                        {s.initials}
                      </span>
                      <span className="text-[11px] font-semibold text-white/80">{s.first_name}</span>
                    </button>
                  ))}
                </div>
              ) : SHOW_DEMO_LOGINS ? (
                <div className="flex justify-center gap-3">
                  {STUDENT_AVATARS.map((av) => (
                    <button
                      key={av.id}
                      onClick={() => { setSelectedAvatar(av.id); setPin(""); }}
                      className={`w-12 h-12 rounded-full ${av.color} text-white font-bold text-lg flex items-center justify-center transition-all ${
                        selectedAvatar === av.id
                          ? "ring-2 ring-white ring-offset-2 ring-offset-transparent scale-110"
                          : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {av.id}
                    </button>
                  ))}
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

              {selectedAvatar && (
                <>
                  <div className="flex justify-center gap-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-4 rounded-full transition-all ${
                          i < pin.length ? "bg-brand-gold scale-110" : "bg-white/25"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[1,2,3,4,5,6,7,8,9].map((d) => (
                      <button
                        key={d}
                        onClick={() => handlePin(String(d))}
                        className="h-14 rounded-card backdrop-blur-sm bg-white/10 border border-white/10 text-white text-xl font-semibold hover:bg-white/20 active:scale-95 transition-all"
                      >
                        {d}
                      </button>
                    ))}
                    <div />
                    <button
                      onClick={() => handlePin("0")}
                      className="h-14 rounded-card backdrop-blur-sm bg-white/10 border border-white/10 text-white text-xl font-semibold hover:bg-white/20 active:scale-95 transition-all"
                    >
                      0
                    </button>
                    <button
                      onClick={() => setPin((p) => p.slice(0, -1))}
                      className="h-14 rounded-card backdrop-blur-sm bg-white/10 border border-white/10 text-white text-xl hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center"
                    >
                      ⌫
                    </button>
                  </div>
                </>
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

              {/* Plain text, not a link: there's no self-service reset, and
                  a link that goes nowhere reads as a broken page. A school's
                  own admin issues a new temporary password from the Teachers
                  or Parents page. */}
              <p className="text-center text-white/55 text-xs leading-relaxed px-4">
                {t("login.forgotPassword")}
              </p>

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
            <Link href="/support" className="hover:text-white/70">{t("login.help")}</Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
