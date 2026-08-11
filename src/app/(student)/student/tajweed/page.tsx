"use client";

import { getAllTajweedRules } from "@/lib/tajweed-rules";

export default function TajweedReferencePage() {
  const rules = getAllTajweedRules();

  return (
    <div className="px-4 pt-4 pb-20 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-ink mb-1">🎨 Tajweed Rules</h1>
        <p className="text-ink-muted">Learn the rules of Quranic recitation</p>
      </div>

      {/* Introduction */}
      <div className="bg-surface-card rounded-3xl border border-surface-border p-6">
        <p className="text-ink leading-relaxed mb-4">
          Tajweed is the art of reciting the Quran with proper pronunciation and rules.
          These colors help you identify important recitation rules as you study.
        </p>
        <div className="bg-blue-50 dark:bg-blue-950/25 rounded-2xl border border-blue-200 dark:border-blue-800/40 p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 <strong>Tip:</strong> Hover over colored letters in the Quran to see which rule applies!
          </p>
        </div>
      </div>

      {/* Rules Grid */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-surface-card rounded-3xl border border-surface-border p-6 space-y-3"
          >
            {/* Rule Header with Color */}
            <div className="flex items-start gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: rule.color }}
              />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-ink">
                  {rule.name}
                </h3>
                <p className="text-sm text-ink-muted font-arabic" dir="rtl">
                  {rule.arabicName}
                </p>
              </div>
            </div>

            {/* Rule Description */}
            <p className="text-sm text-ink-body">
              <strong>What it is:</strong> {rule.description}
            </p>

            {/* Rule Details */}
            <p className="text-sm text-ink leading-relaxed">
              {rule.details}
            </p>

            {/* Examples */}
            <div>
              <p className="text-xs font-semibold text-ink-muted mb-2">
                EXAMPLE LETTERS
              </p>
              <div className="flex flex-wrap gap-2">
                {rule.examples.map((example) => (
                  <span
                    key={example}
                    className={`px-3 py-1.5 rounded-full text-sm font-bold font-arabic ${rule.bgColor}`}
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Practice Tip */}
      <div className="bg-gradient-to-r from-subject-blue to-subject-blue/70 rounded-3xl p-6 text-white text-center">
        <p className="text-lg font-bold mb-2">🎯 Practice Tip</p>
        <p className="text-sm opacity-90">
          As you read each Ayah, focus on one Tajweed rule at a time.
          Gradually, proper recitation will become natural!
        </p>
      </div>
    </div>
  );
}
