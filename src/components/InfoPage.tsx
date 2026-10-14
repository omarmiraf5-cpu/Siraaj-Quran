import Link from "next/link";
import { ByLanguage } from "@/components/ByLanguage";

/**
 * The frame for the public information pages (privacy policy, support):
 * readable measure, the brand header, and a way back to sign in. Server
 * rendered, no sign-in needed — the app stores link to these directly.
 */
export function InfoPage({
  title,
  updated,
  arabic,
  children,
}: {
  title: string;
  updated?: string;
  /** The page in Arabic: its title, date and body. */
  arabic?: { title: string; updated?: string; body: React.ReactNode };
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="gradient-navy text-white">
        <div className="max-w-2xl mx-auto px-5 py-6">
          <Link href="/login" className="text-[12px] font-semibold text-white/60 hover:text-white">
            <ByLanguage en="← MyDiiwaan" ar="→ MyDiiwaan" />
          </Link>
          <h1 className="font-display text-3xl font-bold mt-2">
            <ByLanguage en={title} ar={arabic?.title} />
          </h1>
          {updated && (
            <p className="text-[12.5px] text-white/60 mt-1">
              <ByLanguage en={`Last updated ${updated}`} ar={arabic ? `آخر تحديث: ${arabic.updated ?? updated}` : undefined} />
            </p>
          )}
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-8 pb-16 info-prose">
        <ByLanguage
          en={children}
          ar={arabic?.body}
        />
      </main>
    </div>
  );
}
