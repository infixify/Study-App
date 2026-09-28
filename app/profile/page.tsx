"use client";

import { useEffect, useState } from "react";
import {
  supabase,
  ClassLevel,
  TargetExam,
  StudyMode,
  CLASS_OPTIONS,
  ONLINE_BATCHES,
  OFFLINE_INSTITUTES,
  BATCH_OTHER,
  updateEditableProfile,
} from "@/lib/supabase";
import BottomNav from "@/components/dashboard/BottomNav";

interface UserProfile {
  name: string;
  email: string;
  classLevel: ClassLevel;
  targetExam: TargetExam;
  wantsBoards: boolean;
  studyMode: StudyMode;
  batchName: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [studyMode, setStudyMode] = useState<StudyMode>("Online");
  const [batch, setBatch] = useState<string>("");
  const [editingBatch, setEditingBatch] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userRow } = await supabase
        .from("users")
        .select("name, email, class_level, target_exam, wants_boards, study_mode, batch_or_branch_id, batches(name)")
        .eq("uid", user.id)
        .maybeSingle();

      if (userRow) {
        const batchName = (userRow.batches as any)?.name || "Not set";
        const userProf: UserProfile = {
          name: userRow.name || user.email || "Student",
          email: userRow.email || user.email || "",
          classLevel: userRow.class_level as ClassLevel,
          targetExam: userRow.target_exam as TargetExam,
          wantsBoards: userRow.wants_boards ?? false,
          studyMode: (userRow.study_mode as StudyMode) || "Self",
          batchName: batchName,
        };

        setProfile(userProf);
        setStudyMode(userProf.studyMode);
        setBatch(userProf.batchName === "Not set" ? "" : userProf.batchName);
      }
      setLoading(false);
    }

    loadProfile();
  }, []);

  async function saveEditable(nextMode: StudyMode, nextBatch: string) {
    setSaving(true);
    const res = await updateEditableProfile({ studyMode: nextMode, batchOrBranch: nextBatch });
    if (res.success) {
      setStudyMode(nextMode);
      setBatch(nextBatch);
      setProfile((prev) => (prev ? { ...prev, studyMode: nextMode, batchName: nextBatch || "Self" } : null));
    }
    setSaving(false);
    setEditingBatch(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading your profile…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">No profile found. Please sign in.</p>
      </div>
    );
  }

  const classLabel =
    CLASS_OPTIONS.find((c) => c.value === profile.classLevel)?.label ?? profile.classLevel;

  // Smart dynamic label based on class
  const schoolLabel =
    profile.classLevel === "11"
      ? "School exams prep"
      : profile.classLevel === "Dropper"
      ? "School / Board prep"
      : "Boards prep";

  const schoolValue =
    profile.classLevel === "Dropper"
      ? "Not applicable (Dropper)"
      : profile.wantsBoards
      ? "Yes"
      : "No";

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 py-8">
        <h1 className="font-display text-2xl font-semibold mb-1">Your Profile</h1>
        <p className="text-slate text-sm mb-6">
          Signed in as <span className="font-medium text-ink">{profile.email}</span>
        </p>

        <SectionLabel text="Locked" pillText="Can't change" pillTone="locked" />
        <LockedRow label="Name" value={profile.name} />
        <LockedRow label="Class" value={classLabel} />
        <LockedRow label="Target exam" value={profile.targetExam} />
        <LockedRow label={schoolLabel} value={schoolValue} />
        <p className="text-[11px] text-slate mt-3 mb-8 leading-relaxed">
          Locked fields were set at signup. To change your class or target exam, contact support —
          changing it mid-year would scramble your syllabus, streaks, and test history.
        </p>

        <SectionLabel text="Editable" pillText="Change anytime" pillTone="edit" />

        <EditableRow
          label="Study mode"
          value={studyMode}
          onClick={() => setEditingBatch((v) => !v)}
        />
        <EditableRow
          label="Batch / institute"
          value={batch || "Self Study"}
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

      <BottomNav />
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
    <div className="flex items-center justify-between rounded-ticket border border-ink/12 p-3.5 mb-2 bg-white">
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-slate">{label}</div>
        <div className="text-sm font-semibold mt-0.5 text-ink">{value}</div>
      </div>
      <span className="text-xs">🔒</span>
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
      className="w-full flex items-center justify-between rounded-ticket border border-ink/12 p-3.5 mb-2 text-left bg-white hover:border-ink/25 transition-colors"
    >
      <div>
        <div className="text-[10.5px] uppercase tracking-wide text-slate">{label}</div>
        <div className="text-sm font-semibold mt-0.5 text-ink">{value}</div>
      </div>
      <span className="text-xs text-slate">✎</span>
    </button>
  );
}

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
    <div className="rounded-ticket border border-ink/12 p-4 mt-2 bg-white shadow-xs">
      <div className="flex gap-2 mb-3">
        {(["Online", "Offline", "Self"] as StudyMode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setBatch("");
            }}
            className={`flex-1 text-xs font-semibold rounded-full py-2 border transition-all ${
              mode === m ? "bg-ink text-paper border-ink" : "border-ink/15 text-slate bg-paper/50"
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
              className={`text-left text-sm rounded-lg border p-2.5 transition-all ${
                batch === inst ? "border-marigold bg-marigold/10 font-medium" : "border-ink/12 hover:border-ink/25"
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
                className={`text-left text-sm rounded-lg border p-2.5 transition-all ${
                  batch === key ? "border-marigold bg-marigold/10 font-medium" : "border-ink/12 hover:border-ink/25"
                }`}
              >
                {key}
              </button>
            );
          })}
          <button
            onClick={() => setBatch(BATCH_OTHER)}
            className={`text-left text-sm rounded-lg border p-2.5 transition-all ${
              batch === BATCH_OTHER ? "border-marigold bg-marigold/10 font-medium" : "border-ink/12 hover:border-ink/25"
            }`}
          >
            {BATCH_OTHER}
          </button>
        </div>
      )}

      {mode === "Self" && (
        <p className="text-xs text-slate py-2">No batch needed for self-study.</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 text-xs font-medium rounded-full py-2.5 border border-ink/15 hover:bg-ink/5"
        >
          Cancel
        </button>
        <button
          disabled={saving || (mode !== "Self" && !batch)}
          onClick={() => onSave(mode, mode === "Self" ? "" : batch)}
          className="flex-1 text-xs font-bold rounded-full py-2.5 bg-ink text-paper disabled:opacity-30 shadow-xs"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
