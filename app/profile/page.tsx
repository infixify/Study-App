// app/profile/page.tsx
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
import AppHeader from "@/components/dashboard/AppHeader";

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

  // Editable fields
  const [studyMode, setStudyMode] = useState<StudyMode>("Online");
  const [batch, setBatch] = useState<string>("");
  const [editingBatch, setEditingBatch] = useState(false);
  const [saving, setSaving] = useState(false);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("users")
        .select("name, email, class_level, target_exam, wants_boards, study_mode, batch_name")
        .eq("uid", user.id)
        .maybeSingle();

      if (data) {
        setProfile({
          name: data.name ?? user.user_metadata?.full_name ?? "Student",
          email: data.email ?? user.email ?? "",
          classLevel: data.class_level,
          targetExam: data.target_exam,
          wantsBoards: data.wants_boards ?? false,
          studyMode: data.study_mode ?? "Online",
          batchName: data.batch_name ?? "",
        });
        setStudyMode(data.study_mode ?? "Online");
        setBatch(data.batch_name ?? "");
        setNewName(data.name ?? user.user_metadata?.full_name ?? "");
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSaveName() {
    if (!newName.trim()) return;
    setSavingName(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (user) {
      await supabase.from("users").update({ name: newName.trim() }).eq("uid", user.id);
      await supabase.auth.updateUser({ data: { full_name: newName.trim() } });
      setProfile((prev) => (prev ? { ...prev, name: newName.trim() } : null));
      setEditingName(false);
    }
    setSavingName(false);
  }

  async function saveEditable(nextMode: StudyMode, nextBatch: string) {
    setSaving(true);
    const res = await updateEditableProfile({ studyMode: nextMode, batchOrBranch: nextBatch });
    if (res && res.success) {
      setStudyMode(nextMode);
      setBatch(nextBatch);
      setProfile((prev) => (prev ? { ...prev, studyMode: nextMode, batchName: nextBatch } : null));
      setEditingBatch(false);
    } else {
      alert("Failed to update profile settings.");
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] flex items-center justify-center text-xs font-bold text-slate-400">
        Loading Profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] flex items-center justify-center p-6 text-xs text-slate-400">
        Profile not found. Please log in again.
      </div>
    );
  }

  const classLabel =
    CLASS_OPTIONS.find((c) => c.value === profile.classLevel)?.label ?? profile.classLevel;

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 pb-28">
      <AppHeader />
      <div className="max-w-md mx-auto px-5 py-6">
        <h1 className="font-display text-2xl font-black mb-0.5 tracking-tight text-slate-900 dark:text-white">
          My Profile
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 font-medium">
          Signed in as <span className="font-semibold text-slate-800 dark:text-slate-200">{profile.email}</span>
        </p>

        {/* Section 1: Editable Settings */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Personal & Study Settings
          </span>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-teal/10 dark:bg-teal/20 text-teal dark:text-[#2DD4BF]">
            Editable
          </span>
        </div>

        {/* Name Card */}
        {editingName ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 mb-2.5 bg-white dark:bg-[#121A29] flex items-center gap-2 shadow-sm">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 text-sm font-bold bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl p-2.5 focus:outline-none focus:border-teal"
              placeholder="Enter your name"
              autoFocus
            />
            <button
              onClick={handleSaveName}
              disabled={savingName}
              className="bg-teal text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-xs"
            >
              {savingName ? "…" : "Save"}
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="text-xs font-bold text-slate-400 px-2 py-2"
            >
              Cancel
            </button>
          </div>
        ) : (
          <RowCard
            label="Full Name"
            value={profile.name}
            isEditable
            onClick={() => setEditingName(true)}
          />
        )}

        <RowCard
          label="Study Mode"
          value={studyMode}
          isEditable
          onClick={() => setEditingBatch((v) => !v)}
        />

        <RowCard
          label="Batch / Institute"
          value={batch || "Self Study"}
          isEditable
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

        {/* Section 2: Academic Track (Locked) */}
        <div className="flex items-center justify-between mt-6 mb-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Academic Track
          </span>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300">
            Locked 🔒
          </span>
        </div>

        <RowCard label="Class Level" value={classLabel} isLocked />
        <RowCard label="Target Exam" value={profile.targetExam} isLocked />
        <RowCard label={schoolLabel} value={schoolValue} isLocked />

        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed font-medium">
          Class and Target Exam were locked during signup to keep your test streaks, syllabus progress, and countdown accurate.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}

function RowCard({
  label,
  value,
  isEditable = false,
  isLocked = false,
  onClick,
}: {
  label: string;
  value: string;
  isEditable?: boolean;
  isLocked?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex items-center justify-between w-full">
      <div>
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-sm font-bold mt-0.5 text-slate-900 dark:text-white">
          {value}
        </div>
      </div>
      {isEditable && (
        <span className="text-xs font-bold text-teal dark:text-[#2DD4BF] flex items-center gap-1 hover:underline">
          Edit ✎
        </span>
      )}
      {isLocked && <span className="text-xs opacity-70">🔒</span>}
    </div>
  );

  if (isEditable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left rounded-2xl border border-slate-200 dark:border-white/10 p-3.5 mb-2.5 bg-white dark:bg-[#121A29] hover:border-teal dark:hover:border-teal/50 shadow-sm transition-all active:scale-[0.99]"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-white/10 p-3.5 mb-2.5 bg-white/70 dark:bg-[#121A29]/70 backdrop-blur-xs shadow-xs">
      {content}
    </div>
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
  const [selectedBatch, setSelectedBatch] = useState<string>(currentBatch);
  const [customBatch, setCustomBatch] = useState<string>("");

  const options =
    mode === "Online"
      ? ONLINE_BATCHES
      : mode === "Offline"
      ? OFFLINE_INSTITUTES
      : [];

  const isCustom = !options.includes(selectedBatch) && selectedBatch !== "";

  return (
    <div className="rounded-2xl border border-teal/30 p-4 mb-4 bg-white dark:bg-[#151D2A] shadow-md space-y-3">
      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
        Change Study Mode & Batch
      </h3>

      <div className="grid grid-cols-3 gap-1.5">
        {(["Online", "Offline", "Self"] as StudyMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setSelectedBatch(m === "Self" ? "Self Study" : "");
            }}
            className={`py-2 text-xs font-bold rounded-xl border transition-all ${
              mode === m
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode !== "Self" && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSelectedBatch(opt)}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold border transition-all ${
                selectedBatch === opt
                  ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border-teal/40 font-bold"
                  : "bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300"
              }`}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedBatch(BATCH_OTHER)}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold border transition-all ${
              selectedBatch === BATCH_OTHER || isCustom
                ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border-teal/40 font-bold"
                : "bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300"
            }`}
          >
            {BATCH_OTHER}
          </button>
        </div>
      )}

      {(selectedBatch === BATCH_OTHER || isCustom) && mode !== "Self" && (
        <input
          type="text"
          placeholder="Enter coaching/batch name"
          value={customBatch}
          onChange={(e) => setCustomBatch(e.target.value)}
          className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white outline-none focus:border-teal"
        />
      )}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const finalBatch =
              mode === "Self"
                ? "Self Study"
                : isCustom || selectedBatch === BATCH_OTHER
                ? customBatch || "Other"
                : selectedBatch;
            onSave(mode, finalBatch);
          }}
          className="flex-1 py-2.5 bg-teal text-white font-bold text-xs rounded-xl shadow-xs"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-xs font-bold text-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
