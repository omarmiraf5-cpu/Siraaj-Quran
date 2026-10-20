"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";

/** Signing out of a student's login: the sample one too, and back to the PIN pad. */
export async function signOutStudent(router: ReturnType<typeof useRouter>) {
  try {
    localStorage.removeItem("demo_user");
  } catch {
    /* private mode */
  }
  document.cookie = "demo_mode=; path=/; max-age=0";
  await createClient().auth.signOut().catch(() => {});
  router.replace("/login");
}

/**
 * Two plain buttons on the student's home, where a child can find them:
 * changing their PIN, and signing out — on a shared tablet, the next child
 * needs the PIN pad back. Asked first, since a stray tap would otherwise
 * make them type their PIN again.
 */
export function StudentAccountButtons() {
  const router = useRouter();
  const { t } = useLanguage();
  const pill =
    "inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 text-white text-[12px] font-semibold px-3 py-1.5 transition active:scale-95";
  // Signing out is a quieter outline, kept apart from Change PIN: a stray tap
  // there costs a child their place, so it should not look like the other.
  const quiet =
    "inline-flex items-center gap-1.5 rounded-full border border-white/40 text-white/85 hover:bg-white/10 text-[12px] font-semibold px-3 py-1.5 transition active:scale-95 ms-auto";
  return (
    <div className="relative mt-3 flex items-center gap-2">
      <Link href="/account#pin" className={pill}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        {t("student.changePin")}
      </Link>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(t("student.signOutConfirm"))) signOutStudent(router);
        }}
        className={quiet}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
        {t("common.signOut")}
      </button>
    </div>
  );
}
