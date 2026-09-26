"use client";

import { ClassLevel, CLASS_OPTIONS } from "@/lib/supabase";

interface StepClassProps {
  selected: ClassLevel | null;
  onSelect: (c: ClassLevel) => void;
  onBack: () => void;
}

export default function StepClass({ selected, onSelect, onBack }: StepClassProps) {
  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="font-display text-2xl font-semibold mt-4">
        Which class are you in?
      </h2>
      <p className="text-slate text-sm mt-1 mb-8">
        This decides which chapters and mock tests show up on your dashboard.
        Prepping across both years? Pick the combined track.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {CLASS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`relative text-left rounded-ticket border p-4 transition-colors ${
              selected === opt.value
                ? "border-marigold bg-marigold/10"
                : "border-ink/12 bg-white hover:border-ink/25"
            }`}
          >
            {opt.isNew && (
              <span className="absolute top-2 right-2 text-[9px] font-bold bg-marigold text-ink px-1.5 py-0.5 rounded-full">
                NEW
              </span>
            )}
            <div className="font-display text-xl font-semibold">{opt.label}</div>
            <div className="text-xs text-slate mt-0.5">{opt.sub}</div>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate mt-4 leading-relaxed">
        Heads up: class and target exam can&apos;t be changed after signup —
        double-check before continuing.
      </p>
    </div>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-slate hover:text-ink flex items-center gap-1"
    >
      ← Back
    </button>
  );
}
