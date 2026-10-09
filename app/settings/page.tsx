// app/settings/page.tsx
"use client";

import React, { useEffect, useState, ChangeEvent } from "react";
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

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Name state
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Study Mode & Batch state
  const [studyMode, setStudyMode] = useState<StudyMode>("Online");
  const [batch, setBatch] = useState<string>("");
  const [editingBatch, setEditingBatch] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);

  // Class, Target Exam & School/Boards state
  const [editingAcademic, setEditingAcademic] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassLevel>("11");
  const [selectedTargetExam, setSelectedTargetExam] = useState<TargetExam>("JEE");
  const [wantsBoards, setWantsBoards] = useState<boolean>(true);
  const [savingAcademic, setSavingAcademic] = useState(false);

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

      const resolvedName =
        data?.name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Student";
      const resolvedEmail = data?.email ?? user.email ?? "";
      const resolvedClass = ((data?.class_level as ClassLevel) || "11") as ClassLevel;
      const resolvedExam = ((data?.target_exam as TargetExam) || "JEE") as TargetExam;
      const resolvedWantsBoards =
        data?.wants_boards !== undefined && data?.wants_boards !== null
          ? Boolean(data.wants_boards)
          : true;
      const resolvedMode = (data?.study_mode ?? "Online") as StudyMode;
      const resolvedBatch = data?.batch_name ?? "";

      setProfile({
        name: resolvedName,
        email: resolvedEmail,
        classLevel: resolvedClass,
        targetExam: resolvedExam,
        wantsBoards: resolvedWantsBoards,
        studyMode: resolvedMode,
        batchName: resolvedBatch,
      });

      setNewName(resolvedName);
      setStudyMode(resolvedMode);
      setBatch(resolvedBatch);
      setSelectedClass(resolvedClass);
      setSelectedTargetExam(resolvedExam);
      setWantsBoards(resolvedWantsBoards);

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
      const { error } = await supabase
        .from("users")
        .update({ name: newName.trim() })
        .eq("uid", user.id);

      if (!error) {
        setProfile((prev: UserProfile | null) => (prev ? { ...prev, name: newName.trim() } : null));
        setEditingName(false);
      } else {
        alert("Failed to update name.");
      }
    }
    setSavingName(false);
  }

  async function saveEditableModeAndBatch(nextMode: StudyMode, nextBatch: string) {
    setSavingBatch(true);
    const res = await updateEditableProfile({
      studyMode: nextMode,
      batchOrBranch: nextBatch,
    });
    if (res && res.success) {
      setStudyMode(nextMode);
      setBatch(nextBatch);
      setProfile((prev: UserProfile | null) => (prev ? { ...prev, studyMode: nextMode, batchName: nextBatch } : null));
      setEditingBatch(false);
    } else {
      alert("Failed to update study settings.");
    }
    setSavingBatch(false);
  }

  async function handleSaveAcademic(
    nextClass: ClassLevel,
    nextExam: TargetExam,
    nextWantsBoards: boolean
  ) {
    setSavingAcademic(true);
    const effectiveWantsBoards = nextClass === "Dropper" ? false : nextWantsBoards;
    const res = await updateEditableProfile({
      classLevel: nextClass,
      targetExam: nextExam,
      wantsBoards: effectiveWantsBoards,
    });
    if (res && res.success) {
      setSelectedClass(nextClass);
      setSelectedTargetExam(nextExam);
      setWantsBoards(effectiveWantsBoards);
      setProfile((prev: UserProfile | null) =>
        prev
          ? {
              ...prev,
              classLevel: nextClass,
              targetExam: nextExam,
              wantsBoards: effectiveWantsBoards,
            }
          : null
      );
      setEditingAcademic(false);
    } else {
      alert("Failed to update study info.");
    }
    setSavingAcademic(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] flex items-center justify-center text-xs font-bold text-slate-400">
        Loading Settings…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] flex items-center justify-center p-6 text-xs text-slate-400">
        Could not load settings. Please try again.
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
      ? "Enabled (Tracking ON)"
      : "Disabled";

  const batchDisplay =
    profile.studyMode === "Self"
      ? "Self Study"
      : profile.batchName || "Not assigned";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-white pb-24 transition-colors">
      <AppHeader />

      <div className="max-w-md mx-auto p-4 space-y-6">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
            Settings & Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your academic targets, coaching, and personal information.
          </p>
        </div>

        {/* Section 1: Study Info & Target Exam */}
        <div className="flex items-center justify-between mt-4 mb-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Study Info & Target
          </span>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-teal/10 dark:bg-teal/20 text-teal dark:text-[#2DD4BF]">
            Editable
          </span>
        </div>

        {editingAcademic ? (
          <AcademicEditor
            initialClass={profile.classLevel}
            initialExam={profile.targetExam}
            initialWantsBoards={profile.wantsBoards}
            saving={savingAcademic}
            onSave={handleSaveAcademic}
            onCancel={() => setEditingAcademic(false)}
          />
        ) : (
          <>
            <RowCard
              label="Class Level"
              value={classLabel}
              isEditable
              onClick={() => setEditingAcademic(true)}
            />
            <RowCard
              label="Target Exam"
              value={profile.targetExam}
              isEditable
              onClick={() => setEditingAcademic(true)}
            />
            <RowCard
              label={schoolLabel}
              value={schoolValue}
              isEditable
              onClick={() => setEditingAcademic(true)}
            />
          </>
        )}

        {/* Section 2: Study Coaching & Batch */}
        <div className="flex items-center justify-between mt-6 mb-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Coaching & Batch Settings
          </span>
          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-teal/10 dark:bg-teal/20 text-teal dark:text-[#2DD4BF]">
            Editable
          </span>
        </div>

        <RowCard
          label="Study Mode"
          value={profile.studyMode}
          isEditable
          onClick={() => setEditingBatch(!editingBatch)}
        />
        <RowCard
          label="Batch / Coaching"
          value={batchDisplay}
          isEditable
          onClick={() => setEditingBatch(!editingBatch)}
        />

        {editingBatch && (
          <BatchEditor
            currentMode={studyMode}
            currentBatch={batch}
            saving={savingBatch}
            onSave={saveEditableModeAndBatch}
            onCancel={() => setEditingBatch(false)}
          />
        )}

        {/* Section 3: Personal Info */}
        <div className="flex items-center justify-between mt-6 mb-2.5">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Personal Information
          </span>
        </div>

        <RowCard label="Email" value={profile.email} isLocked />

        {editingName ? (
          <div className="p-4 rounded-2xl bg-white dark:bg-[#121A29] border border-teal/40 space-y-3 shadow-md">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Your Full Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
              className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white outline-none focus:border-teal"
              placeholder="Enter name"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={savingName || !newName.trim()}
                onClick={handleSaveName}
                className="flex-1 py-2 bg-teal text-white font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-opacity"
              >
                {savingName ? "Saving…" : "Save Name"}
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <RowCard
            label="Name"
            value={profile.name}
            isEditable
            onClick={() => setEditingName(true)}
          />
        )}
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
        <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
          {value}
        </div>
      </div>
      {isEditable && (
        <span className="text-xs text-teal font-black flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
          Edit <span>✏️</span>
        </span>
      )}
      {isLocked && (
        <span className="text-xs text-slate-400" title="Locked">
          🔒
        </span>
      )}
    </div>
  );

  if (isEditable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-3.5 mb-2 rounded-2xl bg-white dark:bg-[#121A29] border border-slate-200/80 dark:border-white/10 shadow-xs hover:border-teal/40 dark:hover:border-teal/40 transition-all group"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="w-full text-left p-3.5 mb-2 rounded-2xl bg-white dark:bg-[#121A29] border border-slate-200/80 dark:border-white/10 shadow-xs">
      {content}
    </div>
  );
}

function AcademicEditor({
  initialClass,
  initialExam,
  initialWantsBoards,
  saving,
  onSave,
  onCancel,
}: {
  initialClass: ClassLevel;
  initialExam: TargetExam;
  initialWantsBoards: boolean;
  saving: boolean;
  onSave: (c: ClassLevel, exam: TargetExam, wantsBoards: boolean) => void;
  onCancel: () => void;
}) {
  const [classVal, setClassVal] = useState<ClassLevel>(initialClass);
  const [examVal, setExamVal] = useState<TargetExam>(initialExam);
  const [boardsVal, setBoardsVal] = useState<boolean>(
    initialWantsBoards !== undefined ? initialWantsBoards : true
  );

  const isDropper = classVal === "Dropper";
  const schoolLabel =
    classVal === "11"
      ? "School exams prep"
      : classVal === "Dropper"
      ? "School / Board prep"
      : "Boards prep";

  return (
    <div className="rounded-2xl border border-teal/40 p-4 mb-4 bg-white dark:bg-[#151D2A] shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
          Edit Study Info
        </h3>
        <span className="text-[10px] text-teal font-bold bg-teal/10 px-2 py-0.5 rounded-full">
          Changes sync immediately
        </span>
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
          Select Class
        </label>
        <div className="grid grid-cols-2 gap-2">
          {CLASS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setClassVal(opt.value);
                if (opt.value === "Dropper") {
                  setBoardsVal(false);
                }
              }}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                classVal === opt.value
                  ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border-teal/50 font-bold shadow-xs"
                  : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="text-xs font-bold">{opt.label}</div>
              <div className="text-[10px] opacity-75 mt-0.5 leading-tight">{opt.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
          Target Exam
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["JEE", "NEET"] as TargetExam[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setExamVal(e)}
              className={`p-2.5 rounded-xl border text-center transition-all ${
                examVal === e
                  ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border-teal/50 font-bold shadow-xs"
                  : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
              }`}
            >
              <div className="text-xs font-bold">{e}</div>
              <div className="text-[10px] opacity-75 mt-0.5">
                {e === "JEE" ? "Mains + Advanced" : "NEET-UG"}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
          {schoolLabel}
        </label>
        {isDropper ? (
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-[11px] text-slate-500 font-medium">
            Not applicable for Dropper track.
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setBoardsVal(!boardsVal)}
            className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition-all ${
              boardsVal
                ? "bg-teal/10 dark:bg-teal/20 border-teal/40"
                : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
            }`}
          >
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Preparing for {schoolLabel}?
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {boardsVal ? "Enabled (Default ON)" : "Disabled"}
              </div>
            </div>
            <div
              className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                boardsVal ? "bg-teal" : "bg-slate-300 dark:bg-slate-600"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  boardsVal ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(classVal, examVal, boardsVal)}
          className="flex-1 py-2.5 bg-teal text-white font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-opacity"
        >
          {saving ? "Saving…" : "Save Study Info"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          Cancel
        </button>
      </div>
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

  const rawOptions: string[] =
    mode === "Online"
      ? ONLINE_BATCHES.map((b: { institute: string; name: string }) => `${b.institute} - ${b.name}`)
      : mode === "Offline"
      ? OFFLINE_INSTITUTES
      : [];

  const isCustom = !rawOptions.includes(selectedBatch) && selectedBatch !== "" && selectedBatch !== "Self Study";

  return (
    <div className="rounded-2xl border border-teal/40 p-4 mb-4 bg-white dark:bg-[#151D2A] shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
          Edit Coaching & Batch
        </h3>
      </div>

      <div>
        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
          Study Mode
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(["Online", "Offline", "Self"] as StudyMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setSelectedBatch(m === "Self" ? "Self Study" : "");
              }}
              className={`py-2 text-xs font-bold rounded-xl border text-center transition-all ${
                mode === m
                  ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border-teal/50 shadow-xs"
                  : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode !== "Self" && (
        <div>
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1.5">
            Select {mode === "Online" ? "Batch" : "Institute"}
          </label>
          <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {rawOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedBatch(opt)}
                className={`p-2.5 text-xs text-left rounded-xl border font-semibold transition-all ${
                  selectedBatch === opt
                    ? "bg-teal/10 dark:bg-teal/20 border-teal text-teal dark:text-[#2DD4BF]"
                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                }`}
              >
                {opt}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedBatch(BATCH_OTHER)}
              className={`p-2.5 text-xs text-left rounded-xl border font-semibold transition-all ${
                selectedBatch === BATCH_OTHER || isCustom
                  ? "bg-teal/10 dark:bg-teal/20 border-teal text-teal dark:text-[#2DD4BF]"
                  : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
              }`}
            >
              {BATCH_OTHER}
            </button>
          </div>
        </div>
      )}

      {(selectedBatch === BATCH_OTHER || isCustom) && mode !== "Self" && (
        <input
          type="text"
          placeholder="Enter coaching/batch name"
          value={customBatch}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setCustomBatch(e.target.value)}
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
