"use client";

import { useState } from "react";
import {
  ClassLevel,
  TargetExam,
  StudyMode,
  CLASS_OPTIONS,
  ONLINE_BATCHES,
  OFFLINE_INSTITUTES,
  BATCH_OTHER,
  mockUpdateEditableProfile,
} from "@/lib/supabase";

// In production this data comes from `select * from users where uid = auth.uid()`.
// classLevel / targetExam / wantsBoards are shown read-only because the DB
// trigger (schema.sql: trg_users_lock_after_onboarding) rejects writes to
// them once onboarding_completed = true — so this screen must never send
// them in an update call, only display them.
const MOCK_PROFILE = {
  name: "Aarav Sharma",
  classLevel: "11_12" as ClassLevel,
  targetExam: "JEE" as TargetExam,
  wantsBoards: false,
  studyMode: "Online" as StudyMode,
  batchOrBranch: "Physics Wallah (PW) — Arjuna",
};

export default function ProfilePage() {
  const [studyMode, setStudyMode] = useState<StudyMode>(MOCK_PROFILE.studyMode);
  const [batch, setBatch] = useState<string>(MOCK_PROFILE.batchOrBranch);
  const [editingBatch, setEditingBatch] = useState(false);
  const [saving, setSaving] = useState(false);

  const classLabel =
    CLASS_OPTIONS.find((c) => c.value === MOCK_PROFILE.classLevel)?.label ?? "—";

  async function saveEditable(nextMode: StudyMode, nextBatch: string) {
    setSaving(true);
    await mockUpdateEditableProfile({ studyMode: nextMode, batchOrBranch: nextBatch });
    setStudyMode(nextMode);
    setBatch(nextBatch);
    setSaving(false);
    setEditingBatch(false);
  }

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      <h1 className="font-display text-2xl font-semibold mb-1">Your Profile</h1>
      <p className="text-slate text-sm mb-6">
        Locked fields were set at signup and can&apos;t be changed here.
      </p>

      <SectionLabel text="Locked" pillText="Can't change" pillTone="locked" />
      <LockedRow label="Class" value={classLabel} />
      <LockedRow label="Target exam" value={MOCK_PROFILE.targetExam} />
      <LockedRow label="Boards prep" value={MOCK_PROFILE.wantsBoards ? "Yes" : "No"} />
      <p className="text-[11px] text-slate mt-3 leading-relaxed">
        To change your class or target exam, contact support — changing it
        mid-year would scramble your syllabus, streaks and test history.
      </p>

      <SectionLabel text="Editable" pillText="Change anytime" pillTone="edit" className="mt-8" />

      <EditableRow
        label="Study mode"
        value={studyMode}
        onClick={() => setEditingBatch((v) => !v)}
      />
      <EditableRow
        label="Batch / institute"
        value={batch}
        onClick={() => setEditingBatch((v) => !v)}
      />

      {editingBatch && (
        <BatchEditor
          currentMode={studyMode}
          currentBatch={batch}
          saving={saving}
          onSave={saveEditable}
          onCancel={() => setEditingBatch(false)}
        />
      )}
    </div>
  );
}

function SectionLabel({
  text,
  pillText,
  pillTone,
  className = "",
}: {
  text: string;
  pillText: string;
  pillTone: "locked" | "edit";
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 mb-2.5 ${className}`}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate">
        {text}
      </span>
      <span
        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
          pillTone === "locked" ? "bg-ink/10 text-slate" : "bg-marigold/20 text-marigold"
        }`}
      >
        {pillText}
      </span>
    </div>
  );
}

function LockedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-ticket border border-ink/12 p-3.5 mb-2 opacity-60">
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-slate">{label}</div>
        <div className="text-sm font-semibold mt-0.5">{value}</div>
      </div>
      <span>🔒</span>
    </div>
  );
}

function EditableRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between rounded-ticket border border-ink/12 p-3.5 mb-2 text-left hover:border-ink/25 transition-colors"
    >
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-slate">{label}</div>
        <div className="text-sm font-semibold mt-0.5">{value}</div>
      </div>
      <span>✎</span>
    </button>
  );
}

// Reuses the same grouped-online / institute-only-offline pattern as onboarding.
function BatchEditor({
  currentMode,
  currentBatch,
  saving,
  onSave,
  onCancel,
}: {
  currentMode: StudyMode;
  currentBatch: string;
  saving: boolean;
  onSave: (mode: StudyMode, batch: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<StudyMode>(currentMode);
  const [batch, setBatch] = useState<string>(currentBatch);

  return (
    <div className="rounded-ticket border border-ink/12 p-4 mt-2">
      <div className="flex gap-2 mb-3">
        {(["Online", "Offline", "Self"] as StudyMode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setBatch("");
            }}
            className={`flex-1 text-xs font-medium rounded-full py-2 border ${
              mode === m ? "bg-ink text-paper border-ink" : "border-ink/15"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "Offline" && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {OFFLINE_INSTITUTES.map((inst) => (
            <button
              key={inst}
              onClick={() => setBatch(inst)}
              className={`text-left text-sm rounded-lg border p-2.5 ${
                batch === inst ? "border-marigold bg-marigold/10" : "border-ink/12"
              }`}
            >
              {inst}
            </button>
          ))}
        </div>
      )}

      {mode === "Online" && (
        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {ONLINE_BATCHES.map((b) => {
            const key = `${b.institute} — ${b.name}`;
            return (
              <button
                key={key}
                onClick={() => setBatch(key)}
                className={`text-left text-sm rounded-lg border p-2.5 ${
                  batch === key ? "border-marigold bg-marigold/10" : "border-ink/12"
                }`}
              >
                {key}
              </button>
            );
          })}
          <button
            onClick={() => setBatch(BATCH_OTHER)}
            className={`text-left text-sm rounded-lg border p-2.5 ${
              batch === BATCH_OTHER ? "border-marigold bg-marigold/10" : "border-ink/12"
            }`}
          >
            {BATCH_OTHER}
          </button>
        </div>
      )}

      {mode === "Self" && (
        <p className="text-xs text-slate">No batch needed for self-study.</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 text-xs font-medium rounded-full py-2.5 border border-ink/15"
        >
          Cancel
        </button>
        <button
          disabled={saving || (mode !== "Self" && !batch)}
          onClick={() => onSave(mode, mode === "Self" ? "" : batch)}
          className="flex-1 text-xs font-bold rounded-full py-2.5 bg-ink text-paper disabled:opacity-30"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
