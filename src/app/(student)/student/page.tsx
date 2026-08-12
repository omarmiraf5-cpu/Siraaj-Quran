"use client";

export default function StudentDashboard() {
  return (
    <div className="px-4 pt-6 pb-20 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-ink">👋 Asalamu alaykum!</h1>
        <p className="text-ink-muted mt-1">Welcome to your Quranic Portal</p>
      </div>

      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl p-6 text-white text-center space-y-3">
        <p className="font-arabic text-2xl leading-loose" dir="rtl" lang="ar">
          اللَّهُمَّ لَا سَهْلَ إِلَّا مَا جَعَلْتَهُ سَهْلًا
        </p>
        <p className="text-sm opacity-90">
          &ldquo;O Allah, nothing is easy except what You make easy.&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <a
          href="/student/quran"
          className="bg-surface-card rounded-3xl border border-surface-border p-5 text-center hover:shadow-lg transition-all active:scale-95"
        >
          <p className="text-4xl mb-2">📖</p>
          <p className="font-bold text-ink text-sm">My Quran</p>
          <p className="text-xs text-ink-muted mt-1">View assignments</p>
        </a>
        <a
          href="/student/tajweed"
          className="bg-surface-card rounded-3xl border border-surface-border p-5 text-center hover:shadow-lg transition-all active:scale-95"
        >
          <p className="text-4xl mb-2">🎨</p>
          <p className="font-bold text-ink text-sm">Tajweed Rules</p>
          <p className="text-xs text-ink-muted mt-1">Learn recitation</p>
        </a>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/25 rounded-2xl border border-blue-200 dark:border-blue-800/40 p-4 text-center">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          &ldquo;The best among you are those who learn the Qur&apos;an and teach it.&rdquo;
          <span className="block text-xs mt-1 opacity-70">— Prophet Muhammad &#xFDFA;</span>
        </p>
      </div>
    </div>
  );
}
