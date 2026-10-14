"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { IconBadge, IconLock, IconSignOut } from "@/components/icons";

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
    "inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/18 text-white text-[12px] font-semibold ps-1 pe-3 py-1 transition active:scale-95";
  return (
    <div className="relative mt-3 flex gap-2">
      <Link href="/account#pin" className={pill}>
        <IconBadge size="sm" onNavy>
          <IconLock size={14} />
        </IconBadge>
        {t("student.changePin")}
      </Link>
      <button
        type="button"
        onClick={() => {
          if (window.confirm(t("student.signOutConfirm"))) signOutStudent(router);
        }}
        className={pill}
      >
        <IconBadge size="sm" onNavy>
          <IconSignOut size={14} />
        </IconBadge>
        {t("common.signOut")}
      </button>
    </div>
  );
}
