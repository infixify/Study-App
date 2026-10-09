"use client";

import { useMemo, useState } from "react";
import {
  StudyMode,
  ONLINE_BATCHES,
  OFFLINE_INSTITUTES,
  BATCH_OTHER,
} from "@/lib/supabase";
import { BackButton } from "./StepClass";

interface StepModeProps {
  onFinish: (mode: StudyMode, batchOrBranch: string | null) => void;
  onBack: () => void;
}

const MODES: { value: StudyMode; label: string; sub: string }[] = [
  { value: "Online", label: "Online batch", sub: "PW, Allen, Aakash & more" },
  { value: "Offline", label: "Offline coaching", sub: "In-person at an institute" },
  { value: "Self", label: "Self-study", sub: "No coaching, going solo" },
];

export default function StepMode({ onFinish, onBack }: StepModeProps) {
  const [mode, setMode] = useState<StudyMode | null>(null);
  const [batch, setBatch] = useState<string>("");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsSelection = mode === "Online" || mode === "Offline";
  const canContinue = mode === "Self" || (needsSelection && batch !== "");

  const groupedOnline = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groups: Record<string, typeof ONLINE_BATCHES> = {};
    for (const b of ONLINE_BATCHES) {
      if (q && !(b.institute + " " + b.name).toLowerCase().includes(q)) continue;
      (groups[b.institute] ||= []).push(b);
    }
    return groups;
  }, [search]);

  async function handleFinish() {
    setSubmitting(true);
    await onFinish(mode as StudyMode, needsSelection ? batch : null);
  }

  function pickMode(m: StudyMode) {
    setMode(m);
    setBatch("");
    setSearch("");
  }

  return (
    <div>
      <BackButton onClick={onBack} />
      <h2 className="font-display text-2xl font-semibold mt-4">
        How do you study?
      </h2>
      <p className="text-slate text-sm mt-1 mb-8">
        This decides your batch/institute options next. You can change this
        later from your profile.
      </p>

      <div className="flex flex-col gap-3">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => pickMode(m.value)}
            className={`text-left rounded-ticket border p-4 transition-colors ${
              mode === m.value
                ? "border-marigold bg-marigold/10"
                : "border-ink/12 bg-white hover:border-ink/25"
            }`}
          >
            <div className="font-medium">{m.label}</div>
            <div className="text-xs text-slate mt-0.5">{m.sub}</div>
          </button>
        ))}
      </div>

      {/* ---- OFFLINE: institute name only ---- */}
      {mode === "Offline" && (
        <div className="mt-4">
          <label className="text-xs text-slate mb-1.5 block">
            Select your institute
          </label>
          <div className="flex flex-col gap-2">
            {OFFLINE_INSTITUTES.map((inst) => (
              <button
                key={inst}
                onClick={() => setBatch(inst)}
                className={`flex items-center justify-between rounded-ticket border p-3 text-sm text-left transition-colors ${
                  batch === inst
                    ? "border-marigold bg-marigold/10"
                    : "border-ink/12 bg-white hover:border-ink/25"
                }`}
              >
                <span className="font-medium">{inst}</span>
                <span
                  className={`h-2.5 w-2.5 rounded-full border ${
                    batch === inst ? "bg-marigold border-marigold" : "border-slate"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- ONLINE: grouped by institute, real batch names, searchable ---- */}
      {mode === "Online" && (
        <div className="mt-4">
          <label className="text-xs text-slate mb-1.5 block">
            Select your batch
          </label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch or institute…"
            className="w-full rounded-ticket border border-ink/15 bg-white p-3 text-sm mb-3"
          />
          <div className="max-h-72 overflow-y-auto pr-1">
            {Object.entries(groupedOnline).map(([institute, batches]) => (
              <div key={institute} className="mb-3">
                <div className="text-[11px] uppercase tracking-wide text-slate font-semibold mb-1.5">
                  {institute}
                </div>
                <div className="flex flex-col gap-2">
                  {batches.map((b) => {
                    const key = `${b.institute} — ${b.name}`;
                    return (
                      <button
                        key={key}
                        onClick={() => setBatch(key)}
                        className={`flex items-center justify-between rounded-ticket border p-3 text-left transition-colors ${
                          batch === key
                            ? "border-marigold bg-marigold/10"
                            : "border-ink/12 bg-white hover:border-ink/25"
                        }`}
                      >
                        <span>
                          <div className="text-sm font-medium">{b.name}</div>
                          <div className="text-[10.5px] text-slate">{b.meta}</div>
                        </span>
                        <span
                          className={`h-2.5 w-2.5 rounded-full border shrink-0 ${
                            batch === key ? "bg-marigold border-marigold" : "border-slate"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <button
              onClick={() => setBatch(BATCH_OTHER)}
              className={`w-full flex items-center justify-between rounded-ticket border p-3 text-left transition-colors ${
                batch === BATCH_OTHER
                  ? "border-marigold bg-marigold/10"
                  : "border-ink/12 bg-white hover:border-ink/25"
              }`}
            >
              <span className="text-sm font-medium">{BATCH_OTHER}</span>
              <span
                className={`h-2.5 w-2.5 rounded-full border shrink-0 ${
                  batch === BATCH_OTHER ? "bg-marigold border-marigold" : "border-slate"
                }`}
              />
            </button>
          </div>
        </div>
      )}

      <button
        disabled={!canContinue || submitting}
        onClick={handleFinish}
        className="w-full mt-8 bg-ink text-paper rounded-ticket py-3.5 font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-ink-100 transition-colors"
      >
        {submitting ? "Setting up your dashboard…" : "Finish setup"}
      </button>
    </div>
  );
}

export { StepMode };
