// app/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

// ─── Settings Row ──────────────────────────────────────────────────────────
function SettingsRow({
  icon,
  label,
  subtitle,
  href,
  onClick,
  danger = false,
}: {
  icon: string;
  label: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3.5 w-full">
      <div className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-white/8 flex items-center justify-center text-lg flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-sm font-bold ${danger ? "text-rose-500" : "text-slate-900 dark:text-white"}`}>
          {label}
        </p>
        {subtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{subtitle}</p>
        )}
      </div>
      {!danger && (
        <svg className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </div>
  );

  const baseClass =
    "flex items-center px-4 py-3.5 w-full border-b border-slate-100 dark:border-white/6 last:border-b-0 transition-colors active:bg-slate-50 dark:active:bg-white/4";

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={baseClass}>
      {inner}
    </button>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1 mb-2">
        {title}
      </p>
      <div className="bg-white dark:bg-[#121A29] rounded-2xl border border-slate-200/80 dark:border-white/8 shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ─── Sub-pages ─────────────────────────────────────────────────────────────

function ProfileSubPage({
  profile,
  onBack,
}: {
  profile: UserProfile;
  onBack: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(profile.name);
  const [savingName, setSavingName] = useState(false);
  const [currentName, setCurrentName] = useState(profile.name);

  async function handleSaveName() {
    if (!newName.trim()) return;
    setSavingName(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (user) {
      await supabase.from("users").update({ name: newName.trim() }).eq("uid", user.id);
      await supabase.auth.updateUser({ data: { full_name: newName.trim() } });
      setCurrentName(newName.trim());
      setEditingName(false);
    }
    setSavingName(false);
  }

  return (
    <SubPageShell title="Profile" onBack={onBack}>
      <div className="space-y-2.5">
        {/* Avatar */}
        <div className="flex flex-col items-center py-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-white text-3xl font-black shadow-md mb-3">
            {currentName[0]?.toUpperCase() ?? "S"}
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white">{currentName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{profile.email}</p>
        </div>

        <div className="bg-white dark:bg-[#121A29] rounded-2xl border border-slate-200/80 dark:border-white/8 shadow-sm overflow-hidden">
          {/* Name Row */}
          {editingName ? (
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-white/6">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Full Name</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 text-sm font-bold bg-slate-50 dark:bg-[#1A2438] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 focus:outline-none focus:border-teal"
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="bg-teal text-white text-xs font-bold px-3.5 py-2 rounded-xl"
                >
                  {savingName ? "…" : "Save"}
                </button>
                <button onClick={() => setEditingName(false)} className="text-xs text-slate-400 px-2">✕</button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="flex items-center justify-between w-full px-4 py-3.5 border-b border-slate-100 dark:border-white/6 active:bg-slate-50 dark:active:bg-white/4"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Full Name</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{currentName}</p>
              </div>
              <span className="text-xs font-bold text-teal dark:text-[#2DD4BF]">Edit ✎</span>
            </button>
          )}

          {/* Email (locked) */}
          <div className="flex items-center justify-between px-4 py-3.5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Email</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{profile.email}</p>
            </div>
            <span className="text-xs opacity-60">🔒</span>
          </div>
        </div>
      </div>
    </SubPageShell>
  );
}

function StudyInfoSubPage({
  profile,
  onBack,
}: {
  profile: UserProfile;
  onBack: () => void;
}) {
  const [studyMode, setStudyMode] = useState<StudyMode>(profile.studyMode);
  const [batch, setBatch] = useState(profile.batchName);
  const [editingBatch, setEditingBatch] = useState(false);
  const [saving, setSaving] = useState(false);

  const classLabel = CLASS_OPTIONS.find((c) => c.value === profile.classLevel)?.label ?? profile.classLevel;
  const schoolValue =
    profile.classLevel === "Dropper"
      ? "Not applicable (Dropper)"
      : profile.wantsBoards
      ? "Yes"
      : "No";

  async function saveEditable(nextMode: StudyMode, nextBatch: string) {
    setSaving(true);
    const res = await updateEditableProfile({ studyMode: nextMode, batchOrBranch: nextBatch });
    if (res && res.success) {
      setStudyMode(nextMode);
      setBatch(nextBatch);
      setEditingBatch(false);
    } else {
      alert("Failed to update.");
    }
    setSaving(false);
  }

  return (
    <SubPageShell title="Study Info" onBack={onBack}>
      <div className="space-y-2.5">
        <div className="bg-white dark:bg-[#121A29] rounded-2xl border border-slate-200/80 dark:border-white/8 shadow-sm overflow-hidden">
          {/* Editable */}
          <button
            type="button"
            onClick={() => setEditingBatch((v) => !v)}
            className="flex items-center justify-between w-full px-4 py-3.5 border-b border-slate-100 dark:border-white/6 active:bg-slate-50 dark:active:bg-white/4"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Study Mode</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{studyMode}</p>
            </div>
            <span className="text-xs font-bold text-teal dark:text-[#2DD4BF]">Edit ✎</span>
          </button>

          <button
            type="button"
            onClick={() => setEditingBatch((v) => !v)}
            className="flex items-center justify-between w-full px-4 py-3.5 border-b border-slate-100 dark:border-white/6 active:bg-slate-50 dark:active:bg-white/4"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Batch / Institute</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{batch || "Self Study"}</p>
            </div>
            <span className="text-xs font-bold text-teal dark:text-[#2DD4BF]">Edit ✎</span>
          </button>
        </div>

        {editingBatch && (
          <BatchEditor
            currentMode={studyMode}
            currentBatch={batch}
            saving={saving}
            onSave={saveEditable}
            onCancel={() => setEditingBatch(false)}
          />
        )}

        {/* Locked section */}
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-1 pt-3">
          Academic Track <span className="normal-case font-semibold">(Locked 🔒)</span>
        </p>
        <div className="bg-white/70 dark:bg-[#121A29]/70 rounded-2xl border border-slate-200/60 dark:border-white/6 shadow-xs overflow-hidden">
          {[
            { label: "Class Level", value: classLabel },
            { label: "Target Exam", value: profile.targetExam },
            { label: profile.classLevel === "11" ? "School Exams Prep" : "Boards Prep", value: schoolValue },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/60 dark:border-white/4 last:border-b-0">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{value}</p>
              </div>
              <span className="text-xs opacity-50">🔒</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed font-medium px-1">
          Class and Target Exam were locked during signup to keep your test streaks, syllabus progress, and countdown accurate.
        </p>
      </div>
    </SubPageShell>
  );
}

function AppearanceSubPage({ onBack }: { onBack: () => void }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("prepwise_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("prepwise_theme", "light");
    }
  };

  return (
    <SubPageShell title="Appearance" onBack={onBack}>
      <div className="bg-white dark:bg-[#121A29] rounded-2xl border border-slate-200/80 dark:border-white/8 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="text-xl">{isDark ? "🌙" : "☀️"}</span>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {isDark ? "Dark Theme" : "Light Theme"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isDark ? "Dark Midnight mode" : "Light Clean mode"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold bg-teal/10 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border border-teal/20"
          >
            Switch
          </button>
        </div>
      </div>
    </SubPageShell>
  );
}

// ─── Shared sub-page shell ──────────────────────────────────────────────────
function SubPageShell({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-in slide-in-from-right duration-200">
      <div className="flex items-center gap-3 mb-5">
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-white/8 flex items-center justify-center transition-all active:scale-95"
        >
          <svg className="w-5 h-5 text-slate-700 dark:text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h2 className="font-display text-xl font-black text-slate-900 dark:text-white tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// ─── BatchEditor (copied from profile) ──────────────────────────────────────
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
      ? (ONLINE_BATCHES as unknown as string[])
      : mode === "Offline"
      ? (OFFLINE_INSTITUTES as unknown as string[])
      : [];

  const isCustom = !rawOptions.includes(selectedBatch) && selectedBatch !== "";

  return (
    <div className="rounded-2xl border border-teal/30 p-4 bg-white dark:bg-[#151D2A] shadow-md space-y-3">
      <h3 className="text-xs font-bold text-slate-900 dark:text-white">Change Study Mode & Batch</h3>
      <div className="grid grid-cols-3 gap-1.5">
        {(["Online", "Offline", "Self"] as StudyMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setSelectedBatch(m === "Self" ? "Self Study" : ""); }}
            className={`py-2 text-xs font-bold rounded-xl border transition-all ${mode === m ? "bg-teal text-white border-teal" : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"}`}
          >
            {m}
          </button>
        ))}
      </div>
      {mode !== "Self" && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {rawOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSelectedBatch(opt)}
              className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold border transition-all ${selectedBatch === opt ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border-teal/40 font-bold" : "bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300"}`}
            >
              {opt}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedBatch(BATCH_OTHER)}
            className={`w-full text-left p-2.5 rounded-xl text-xs font-semibold border transition-all ${selectedBatch === BATCH_OTHER || isCustom ? "bg-teal/15 dark:bg-teal/20 text-teal dark:text-[#2DD4BF] border-teal/40 font-bold" : "bg-slate-50 dark:bg-white/5 border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300"}`}
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
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const finalBatch =
              mode === "Self" ? "Self Study"
              : isCustom || selectedBatch === BATCH_OTHER
              ? customBatch || "Other"
              : selectedBatch;
            onSave(mode, finalBatch);
          }}
          className="flex-1 py-2.5 bg-teal text-white font-bold text-xs rounded-xl"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2.5 text-xs font-bold text-slate-400">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────────────────────
type SubPage = "profile" | "studyInfo" | "appearance" | null;

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [subPage, setSubPage] = useState<SubPage>(null);

  useEffect(() => {
    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) { setLoading(false); return; }

      const res = await supabase
        .from("users")
        .select("name, email, class_level, target_exam, wants_boards, study_mode, batch_name")
        .eq("uid", user.id)
        .maybeSingle();
      const data = res.data;

      const resolvedName = data?.name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Student";

      setProfile({
        name: resolvedName,
        email: data?.email ?? user.email ?? "",
        classLevel: ((data?.class_level as string) ?? "11") as ClassLevel,
        targetExam: ((data?.target_exam as string) ?? "JEE") as TargetExam,
        wantsBoards: data?.wants_boards ?? false,
        studyMode: ((data?.study_mode as string) ?? "Online") as StudyMode,
        batchName: (data?.batch_name as string) ?? "",
      });
      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/onboarding");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] flex items-center justify-center text-xs font-bold text-slate-400">
        Loading…
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

  const initials = profile.name[0]?.toUpperCase() ?? "S";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090E17] text-slate-900 dark:text-slate-100 pb-28">
      <AppHeader />
      <div className="max-w-md mx-auto px-4 py-6">

        {/* ── Sub-page overlay ── */}
        {subPage === "profile" && (
          <ProfileSubPage profile={profile} onBack={() => setSubPage(null)} />
        )}
        {subPage === "studyInfo" && (
          <StudyInfoSubPage profile={profile} onBack={() => setSubPage(null)} />
        )}
        {subPage === "appearance" && (
          <AppearanceSubPage onBack={() => setSubPage(null)} />
        )}

        {/* ── Main list (hidden when sub-page open) ── */}
        {!subPage && (
          <>
            {/* Title + avatar */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="font-display text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  ⚙️ Settings
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {profile.email}
                </p>
              </div>
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-400 flex items-center justify-center text-white text-lg font-black shadow-md">
                {initials}
              </div>
            </div>

            {/* ACCOUNT */}
            <SettingsSection title="Account">
              <SettingsRow
                icon="👤"
                label="Profile"
                subtitle="Name, photo & email"
                onClick={() => setSubPage("profile")}
              />
              <SettingsRow
                icon="📖"
                label="Study Info"
                subtitle="Class, target year & coaching"
                onClick={() => setSubPage("studyInfo")}
              />
              <SettingsRow
                icon="🎯"
                label="Goals"
                subtitle="Mains & Advanced score targets"
                href="/goals"
              />
            </SettingsSection>

            {/* PREFERENCES */}
            <SettingsSection title="Preferences">
              <SettingsRow
                icon="🎨"
                label="Appearance"
                subtitle="Theme, accent color & layout"
                onClick={() => setSubPage("appearance")}
              />
              <SettingsRow
                icon="🔔"
                label="Alerts"
                subtitle="Notifications & email reports"
                href="/settings/alerts"
              />
            </SettingsSection>

            {/* SYSTEM */}
            <SettingsSection title="System">
              <SettingsRow
                icon="🗄️"
                label="Data & Backup"
                subtitle="Export, import & reset data"
                href="/settings/data"
              />
              <SettingsRow
                icon="🪪"
                label="Account"
                subtitle="Session & app info"
                href="/settings/account"
              />
              <SettingsRow
                icon="💬"
                label="Feedback"
                subtitle="Send us a bug report or idea"
                href="/feedback"
              />
              <SettingsRow
                icon="✉️"
                label="Contact"
                subtitle="Support, website & policies"
                href="/contact"
              />
              <SettingsRow
                icon="☕"
                label="Support Us"
                subtitle="Buy the team a coffee"
                href="/support"
              />
            </SettingsSection>

            {/* Sign out */}
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 text-sm font-bold text-rose-500 bg-rose-500/8 dark:bg-rose-500/10 rounded-2xl border border-rose-500/15 active:scale-[0.99] transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign Out
            </button>

            <p className="text-center text-[10px] text-slate-400 dark:text-slate-600 mt-5 font-medium">
              PrepWise · v{"{"}process.env.NEXT_PUBLIC_APP_VERSION || "1.0"{"}"}
            </p>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
