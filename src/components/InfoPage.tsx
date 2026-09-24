import Link from "next/link";

/**
 * The frame for the public information pages (privacy policy, support):
 * readable measure, the brand header, and a way back to sign in. Server
 * rendered, no sign-in needed — the app stores link to these directly.
 */
export function InfoPage({ title, updated, children }: { title: string; updated?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-bg">
      <header className="gradient-navy text-white">
        <div className="max-w-2xl mx-auto px-5 py-6">
          <Link href="/login" className="text-[12px] font-semibold text-white/60 hover:text-white">
            ← MyDiiwaan
          </Link>
          <h1 className="font-display text-3xl font-bold mt-2">{title}</h1>
          {updated && <p className="text-[12.5px] text-white/60 mt-1">Last updated {updated}</p>}
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 py-8 pb-16 info-prose">{children}</main>
    </div>
  );
}
