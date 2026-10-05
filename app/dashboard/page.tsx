// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import { loadAndReconcileStreak } from "@/lib/focus";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/BottomNav";
import AppHeader from "@/components/dashboard/AppHeader";
import AiMentorCard from "@/components/dashboard/AiMentorCard";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

declare global {
  interface Window {
    AppBridge?: { postMessage: (message: string) => void; };
    onNativeFCMToken?: (token: string) => void;
    onNativeFocusSessionLogged?: (mins: number) => void;
    onDirectLoggedSession?: (data: any) => void;
  }
}

// ─── HIGH-SPEED SWR IN-MEMORY CACHE (0ms Section Switch) ───
const CACHE_TTL_MS = 2 * 60 * 1000;
const globalMemoryCache: Record<string, { timestamp: number; data: any }> = {};

function getMemCache<T>(key: string): T | null {
  const item = globalMemoryCache[key];
  if (item && Date.now() - item.timestamp < CACHE_TTL_MS) return item.data as T;
  try {
    const raw = localStorage.getItem(`pw_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS * 3) {
        globalMemoryCache[key] = parsed;
        return parsed.data as T;
      }
    }
  } catch (_) {}
  return null;
}

function setMemCache<T>(key: string, data: T): void {
  const payload = { timestamp: Date.now(), data };
  globalMemoryCache[key] = payload;
  try { localStorage.setItem(`pw_cache_${key}`, JSON.stringify(payload)); } catch (_) {}
}

interface ExamScheduleItem {
  id: string; exam_key: string; label: string; target_exam: string; year: number; exam_date: string; is_confirmed: boolean;
}
interface ExamShift {
  id: string; exam_schedule_id: string; shift_date: string; shift_time: string;
}
interface TaskItem {
  id: string; title: string; priority: string; status: string; task_type?: string; due_date?: string;
}
interface ScheduledTest {
  id: string; test_name: string; scheduled_date: string; subject?: string; status: string;
}
interface TestLog {
  id: string; test_name: string; total_marks: number; max_marks: number; accuracy: number; test_date: string;
}
interface SubjectItem {
  id: string; name: string; class_level: string; target_exam?: string;
}
interface ChapterItem {
  id: string; title: string; subject_id: string;
}
interface DailyLogItem {
  log_date: string; study_time_minutes: number; theory_minutes?: number; practice_minutes?: number; revision_minutes?: number; verified_minutes?: number;
}
interface QuestionLogEntry {
  id: string; subject_id: string; chapter_id: string; question_count: number; topic_name?: string; start_from?: number; end_on?: number; log_date: string; time_from?: string | null; time_to?: string | null; source?: string | null;
}
interface ContentCardItem {
  id: string; quote: string; character: string; show: string; icon_or_sticker: string; color: string; bg: string; border: string; text: string; badge: string;
}

const COLOR_PRESETS = [
  { color: "from-sky-500 to-indigo-600", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-950", badge: "bg-sky-500" },
  { color: "from-amber-500 to-orange-600", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-950", badge: "bg-amber-500" },
  { color: "from-purple-600 to-indigo-600", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-950", badge: "bg-purple-600" },
  { color: "from-teal-500 to-emerald-600", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-950", badge: "bg-teal-500" },
];

const QUOTE_LIMIT = 3;
const MEME_LIMIT = 2;

function getTodayKey(): string {
  return `pw_content_state_${new Date().toISOString().split("T")[0]}`;
}
interface DailyContentState {
  motivationIndex: number; memeIndex: number; motivationCount: number; memeCount: number; selectedMotivationId: string; selectedMemeId: string;
}
function loadDailyContentState(): DailyContentState {
  try {
    const raw = localStorage.getItem(getTodayKey());
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { motivationIndex: 0, memeIndex: 0, motivationCount: 0, memeCount: 0, selectedMotivationId: "", selectedMemeId: "" };
}
function saveDailyContentState(state: DailyContentState): void {
  try { localStorage.setItem(getTodayKey(), JSON.stringify(state)); } catch (_) {}
}
function getDailyIndex(deckLength: number, salt: string): number {
  if (!deckLength) return 0;
  const str = new Date().toISOString().split("T")[0] + salt;
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  return Math.abs(hash) % deckLength;
}

const FALLBACK_MOTIVATION: ContentCardItem[] = [{
  id: "m-1", quote: "Dream is not that which you see while sleeping, it is something that does not let you sleep.", character: "Dr. A.P.J. Abdul Kalam", show: "Wings of Fire", icon_or_sticker: "🚀", color: "from-sky-500 to-indigo-600", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-950", badge: "bg-sky-500",
}];
const FALLBACK_MEME: ContentCardItem[] = [{
  id: "meme-1", quote: "PAKAD PAKAD PAKAD... Isne aaj tak numericals solve nahi kiye! Daya, iska phone tod do! 😂", character: "ACP Pradyuman", show: "CID (Meme)", icon_or_sticker: "👮", color: "from-gray-600 to-gray-800", bg: "bg-gray-50", border: "border-gray-300", text: "text-gray-950", badge: "bg-gray-600",
}];

function getGreeting(name: string, hour: number): string {
  if (hour >= 5 && hour < 9) return `Rise & grind, ${name}! 🌅`;
  if (hour >= 9 && hour < 12) return `Good morning, ${name}! ☀️`;
  if (hour >= 12 && hour < 14) return `Lunch break, ${name}? 🍱 Back to books!`;
  if (hour >= 14 && hour < 17) return `Afternoon session, ${name}! 💪`;
  if (hour >= 17 && hour < 20) return `Evening grind, ${name}! 🌆`;
  if (hour >= 20 && hour < 23) return `Late night mode, ${name}! 🌙`;
  return `Night owl alert, ${name}! 🦉 Sleep matters too!`;
}

function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length < 2) return null;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

function computeTodayAvgQPerHr(entries: QuestionLogEntry[]): number {
  let totalMinutes = 0;
  let totalQs = 0;
  for (const e of entries) {
    const from = timeToMinutes(e.time_from);
    const to = timeToMinutes(e.time_to);
    if (from !== null && to !== null && to > from) {
      totalMinutes += to - from;
      totalQs += e.question_count || 0;
    }
  }
  return totalMinutes > 0 ? Math.round((totalQs / totalMinutes) * 60) : 0;
}

function timeRangesOverlap(aFrom?: string | null, aTo?: string | null, bFrom?: string | null, bTo?: string | null): boolean {
  const af = timeToMinutes(aFrom), at = timeToMinutes(aTo), bf = timeToMinutes(bFrom), bt = timeToMinutes(bTo);
  if (af === null || at === null || bf === null || bt === null) return false;
  return af < bt && bf < at;
}

function HeroWidget({ name, streak, todayStudyMins, dailyGoalMins, onGoalSaved }: any) {
  const [hour, setHour] = useState(() => new Date().getHours());
  const [mode, setMode] = useState<"motivation" | "meme">(() => {
    try { return (localStorage.getItem("pw_content_mode") as any) || "motivation"; } catch { return "motivation"; }
  });
  const [dbItems, setDbItems] = useState(() => getMemCache<any>("daily_content_deck") || { motivation: FALLBACK_MOTIVATION, meme: FALLBACK_MEME });
  const [currentItem, setCurrentItem] = useState<ContentCardItem | null>(null);
  const [imgKey, setImgKey] = useState(0);
  const [showGoalPopup, setShowGoalPopup] = useState(false);
  const [goalHours, setGoalHours] = useState(Math.round(dailyGoalMins / 60) || 8);
  const [dailyState, setDailyState] = useState<DailyContentState>(() => loadDailyContentState());
  const [limitHit, setLimitHit] = useState(false);
  const limitTimerRef = React.useRef<any>(null);

  useEffect(() => {
    const interval = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (getMemCache("daily_content_deck")) return;
    supabase.from("daily_content").select("*").eq("is_active", true).then(({ data }) => {
      if (data && data.length > 0) {
        const mList: ContentCardItem[] = [], rList: ContentCardItem[] = [];
        data.forEach((row: any, idx: number) => {
          const fb = COLOR_PRESETS[idx % COLOR_PRESETS.length];
          const it = {
            id: row.id, quote: row.quote, character: row.character, show: row.show || "PrepWise",
            icon_or_sticker: row.icon_or_sticker || "⚡", color: row.gradient_color || fb.color,
            bg: row.bg_color || fb.bg, border: row.border_color || fb.border, text: row.text_color || fb.text, badge: row.badge_color || fb.badge,
          };
          if (row.content_type === "meme") rList.push(it); else mList.push(it);
        });
        const deck = { motivation: mList.length ? mList : FALLBACK_MOTIVATION, meme: rList.length ? rList : FALLBACK_MEME };
        setDbItems(deck);
        setMemCache("daily_content_deck", deck);
      }
    });
  }, []);

  useEffect(() => {
    const deck = mode === "motivation" ? (dbItems.motivation.length ? dbItems.motivation : FALLBACK_MOTIVATION) : (dbItems.meme.length ? dbItems.meme : FALLBACK_MEME);
    const saved = loadDailyContentState();
    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    setLimitHit(false);

    let item = deck.find((c: any) => c.id === (mode === "motivation" ? saved.selectedMotivationId : saved.selectedMemeId));
    if (!item) {
      const idx = getDailyIndex(deck.length, mode);
      item = deck[idx] || deck[0];
      const next = mode === "motivation" ? { ...saved, motivationIndex: idx, selectedMotivationId: item.id } : { ...saved, memeIndex: idx, selectedMemeId: item.id };
      setDailyState(next);
      saveDailyContentState(next);
    }
    setCurrentItem(item);
    setImgKey((k) => k + 1);
  }, [dbItems, mode]);

  const handleTap = useCallback(() => {
    const deck = mode === "motivation" ? dbItems.motivation : dbItems.meme;
    const saved = loadDailyContentState();
    const count = mode === "motivation" ? saved.motivationCount : saved.memeCount;
    const limit = mode === "motivation" ? QUOTE_LIMIT : MEME_LIMIT;

    if (count >= limit) {
      setLimitHit(true);
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
      limitTimerRef.current = setTimeout(() => setLimitHit(false), 3000);
      return;
    }

    const nextIdx = ((mode === "motivation" ? saved.motivationIndex : saved.memeIndex) + 1) % deck.length;
    const nextItem = deck[nextIdx] || deck[0];
    const nextState = mode === "motivation"
      ? { ...saved, motivationIndex: nextIdx, motivationCount: count + 1, selectedMotivationId: nextItem.id }
      : { ...saved, memeIndex: nextIdx, memeCount: count + 1, selectedMemeId: nextItem.id };

    setDailyState(nextState);
    saveDailyContentState(nextState);
    setCurrentItem(nextItem);
    setImgKey((k) => k + 1);
    if (count + 1 >= limit) {
      setLimitHit(true);
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
      limitTimerRef.current = setTimeout(() => setLimitHit(false), 3000);
    }
  }, [dbItems, mode]);

  const greeting = getGreeting(name, hour);
  const todayHours = (todayStudyMins / 60).toFixed(1);
  const goalReached = todayStudyMins >= dailyGoalMins && dailyGoalMins > 0;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-2xs">
      <div className={`h-1 w-full bg-gradient-to-r ${currentItem?.color || "from-indigo-500 to-teal-500"}`} />
      <div className="p-3 pb-2.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">PrepWise Cockpit</p>
            <h2 className="text-xs font-black text-slate-900 leading-snug truncate">{greeting}</h2>
          </div>
          <div className={`shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 ${streak > 0 ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-200"}`}>
            <span className="text-sm leading-none">{streak > 0 ? "🔥" : "💤"}</span>
            <span className={`text-sm font-black leading-none ${streak > 0 ? "text-orange-600" : "text-slate-400"}`}>{streak}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase">{streak === 1 ? "Day" : "Days"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <div className={`flex-1 border rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 ${goalReached ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
            <span className="text-sm">{goalReached ? "🎯" : "⏱️"}</span>
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-black ${goalReached ? "text-emerald-700" : "text-slate-900"}`}>{todayHours}h studied</span>
              {dailyGoalMins > 0 && <span className="text-[9px] font-semibold text-slate-400 ml-1">/ {(dailyGoalMins/60).toFixed(0)}h goal</span>}
            </div>
          </div>
          <button type="button" onClick={() => setShowGoalPopup(true)} className="text-[9px] font-black text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-xl hover:bg-slate-100">
            ✎ Goal
          </button>
        </div>

        {showGoalPopup && (
          <div className="mb-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <p className="text-[10px] font-black text-slate-600 mb-1.5">Daily Study Goal (hours)</p>
            <div className="flex gap-2">
              <input type="number" min={1} max={18} value={goalHours} onChange={(e) => setGoalHours(parseInt(e.target.value) || 8)} className="flex-1 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-center bg-white" />
              <button type="button" onClick={() => { onGoalSaved(goalHours * 60); setShowGoalPopup(false); }} className="px-3 bg-teal text-white text-xs font-bold rounded-lg">Save</button>
              <button type="button" onClick={() => setShowGoalPopup(false)} className="px-2 bg-slate-200 text-slate-700 text-xs font-bold rounded-lg">✕</button>
            </div>
          </div>
        )}

        <div className="flex gap-1.5 mb-2">
          {(["motivation", "meme"] as const).map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); try { localStorage.setItem("pw_content_mode", m); } catch (_) {} }} className={`flex-1 text-[9px] font-black uppercase tracking-wide rounded-lg py-1 border transition-all ${mode === m ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200"}`}>
              {m === "motivation" ? "💡 Quote" : "😂 Meme"}
            </button>
          ))}
        </div>

        {currentItem && (
          <button type="button" onClick={handleTap} className={`w-full text-left rounded-2xl border ${currentItem.border} ${currentItem.bg} p-3 active:scale-[0.98] transition-all relative overflow-hidden group shadow-2xs`}>
            <div className="flex items-center gap-3">
              <div className={`w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center ${currentItem.badge} overflow-hidden`}>
                {currentItem.icon_or_sticker && (currentItem.icon_or_sticker.startsWith("http") || currentItem.icon_or_sticker.startsWith("/")) ? (
                  <img key={imgKey} src={currentItem.icon_or_sticker} alt="" className="w-full h-full object-cover rounded-2xl" onError={(e) => { (e.target as any).style.display = "none"; }} />
                ) : (
                  <span className="text-3xl">{currentItem.icon_or_sticker || "💡"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${currentItem.text} leading-snug`}>"{currentItem.quote}"</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
                  <p className="text-[10px] font-black text-slate-600 truncate">— {currentItem.character}</p>
                  <span className="text-[9.5px] font-bold text-slate-500 bg-white/90 border border-slate-200/90 px-1.5 py-0.5 rounded-full shrink-0">Tap ↻</span>
                </div>
              </div>
            </div>
          </button>
        )}

        {limitHit && (
          <p className="mt-1.5 text-center text-[10px] font-bold text-red-500">
            {mode === "motivation" ? `Only ${QUOTE_LIMIT} quotes per day — come back tomorrow! 🌅` : `Only ${MEME_LIMIT} memes per day — back to books! 📚`}
            {" · "}<span className="underline cursor-pointer">Upgrade for more</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [todayStudyMins, setTodayStudyMins] = useState(0);
  const [dailyGoalMins, setDailyGoalMins] = useState(480);
  const [todayQuestions, setTodayQuestions] = useState(0);
  const [totalQuestionsAllTime, setTotalQuestionsAllTime] = useState(0);
  const [todayAvgQPerHr, setTodayAvgQPerHr] = useState(0);
  const [streak, setStreak] = useState(0);

  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [scheduledTests, setScheduledTests] = useState<ScheduledTest[]>([]);
  const [recentTests, setRecentTests] = useState<TestLog[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chapterProgress, setChapterProgress] = useState<{ chapter_id: string; status: string }[]>([]);
  const [splitRatio, setSplitRatio] = useState({ theory: 0, practice: 0, revision: 0, verified: 0 });
  const [examSchedules, setExamSchedules] = useState<ExamScheduleItem[]>([]);
  const [shiftsMap, setShiftsMap] = useState<Record<string, ExamShift[]>>({});
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // Question Modal State
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [todayQuestionEntries, setTodayQuestionEntries] = useState<QuestionLogEntry[]>([]);
  const [selectedDistinctSubject, setSelectedDistinctSubject] = useState<string>("");
  const [qChapterId, setQChapterId] = useState("");
  const [qTopicName, setQTopicName] = useState("");
  const [qCount, setQCount] = useState("30");
  const [qStartFrom, setQStartFrom] = useState("1");
  const [qEndOn, setQEndOn] = useState("30");
  const [qTimeFrom, setQTimeFrom] = useState<string>(() => `${String(new Date().getHours()).padStart(2, "0")}:00`);
  const [qTimeTo, setQTimeTo] = useState<string>(() => `${String((new Date().getHours() + 1) % 24).padStart(2, "0")}:00`);
  const [qLogDate, setQLogDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionConflictWarning, setQuestionConflictWarning] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      // 1. Instant Cache Hydration (0ms load)
      const cached = getMemCache<any>("full_dashboard_state");
      if (cached && !isCancelled) {
        setProfile(cached.profile); setUser(cached.user); setSelectedShiftId(cached.selectedShiftId);
        setDailyGoalMins(cached.dailyGoalMins); setSubjects(cached.subjects || []); setChapters(cached.chapters || []);
        if (cached.distinctSub) setSelectedDistinctSubject(cached.distinctSub);
        if (cached.initChap) setQChapterId(cached.initChap);
        setExamSchedules(cached.examSchedules || []); setShiftsMap(cached.shiftsMap || {});
        setTodayStudyMins(cached.todayStudyMins || 0); setSplitRatio(cached.splitRatio || { theory: 0, practice: 0, revision: 0, verified: 0 });
        setTotalQuestionsAllTime(cached.totalQuestionsAllTime || 0); setTodayQuestions(cached.todayQuestions || 0);
        setTodayQuestionEntries(cached.todayQuestionEntries || []); setTodayAvgQPerHr(cached.todayAvgQPerHr || 0);
        setStreak(cached.streak || 0); setChapterProgress(cached.chapterProgress || []); setAllTasks(cached.allTasks || []);
        setScheduledTests(cached.scheduledTests || []); setRecentTests(cached.recentTests || []);
        setLoading(false);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!cached) router.push("/"); return; }
      const currentUser = session.user;
      const uid = currentUser.id;
      if (!isCancelled) setUser(currentUser);

      const { data: uProf } = await supabase.from("users").select("*").eq("uid", uid).maybeSingle();
      if (!uProf || isCancelled) return;

      setProfile(uProf);
      setSelectedShiftId(uProf.selected_shift_id || null);
      setDailyGoalMins(uProf.daily_goal_minutes || 480);

      const targetExam = uProf.target_exam || "JEE";
      const allowedClasses = classLevelsForContent(uProf.class_level);
      const targetYear = Number(uProf.target_year) || 2027;
      const wantsBoards = uProf.class_level !== "Dropper" && Boolean(uProf.wants_boards);
      const isDropper = uProf?.class_level === "Dropper";

      // 2. Parallel Burst of all queries
      const [subjectsRes, schedulesRes, pastLogsRes, qLogsRes, progRes, tasksRes, schedTestsRes, recentTestsRes] = await Promise.all([
        supabase.from("subjects").select("id, name, class_level, target_exam").in("class_level", allowedClasses.length ? allowedClasses : ["11", "12"]),
        supabase.from("exam_schedule").select("*").eq("year", targetYear).order("display_order", { ascending: true }),
        supabase.from("daily_logs").select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, verified_minutes, streak_count, log_date").eq("user_id", uid).order("log_date", { ascending: false }).limit(84),
        supabase.from("question_logs").select("id, question_count, log_date, topic_name, start_from, end_on, subject_id, chapter_id, time_from, time_to, source").eq("user_id", uid).order("log_date", { ascending: false }),
        supabase.from("chapter_progress").select("chapter_id, status").eq("user_id", uid),
        supabase.from("tasks").select("id, title, priority, status, task_type, due_date").eq("user_id", uid).neq("status", "completed").order("created_at", { ascending: false }),
        supabase.from("test_schedule").select("id, test_name, scheduled_date, subject, status").eq("user_id", uid).eq("status", "upcoming").order("scheduled_date", { ascending: true }).limit(5),
        supabase.from("test_logs").select("id, test_name, total_marks, max_marks, accuracy, test_date").eq("user_id", uid).order("test_date", { ascending: false }).limit(2),
      ]);

      if (isCancelled) return;

      let cleanedSubs: SubjectItem[] = [];
      let chapsData: ChapterItem[] = [];
      let distinctSub = "", initChap = "";

      if (subjectsRes.data) {
        cleanedSubs = subjectsRes.data.filter((s) => {
          const norm = (s.name || "").trim().toLowerCase();
          if (targetExam === "JEE" && (norm.includes("bio") || s.target_exam === "NEET")) return false;
          if (targetExam === "NEET" && (norm.includes("math") || s.target_exam === "JEE")) return false;
          return true;
        });
        setSubjects(cleanedSubs);
        const distinctNames = Array.from(new Set(cleanedSubs.map((s) => s.name.trim())));
        distinctSub = distinctNames[0] || "";
        if (distinctSub) setSelectedDistinctSubject(distinctSub);

        const subIds = cleanedSubs.map((s) => s.id);
        if (subIds.length > 0) {
          let cq = supabase.from("chapters").select("id, title, subject_id, in_competitive_syllabus").in("subject_id", subIds).order("display_order", { ascending: true });
          if (isDropper) cq = cq.neq("in_competitive_syllabus", false);
          const { data: chaps } = await cq;
          if (chaps) {
            chapsData = chaps;
            setChapters(chaps);
            const firstActiveSubIds = cleanedSubs.filter((s) => s.name.trim().toLowerCase() === distinctSub.toLowerCase()).map((s) => s.id);
            const initialChaps = chaps.filter((c) => firstActiveSubIds.includes(c.subject_id));
            if (initialChaps[0]) { initChap = initialChaps[0].id; setQChapterId(initChap); }
          }
        }
      }

      let studentSchedules: ExamScheduleItem[] = [];
      let sMap: Record<string, ExamShift[]> = {};
      if (schedulesRes.data && schedulesRes.data.length > 0) {
        studentSchedules = schedulesRes.data.filter((s) => s.target_exam === "Boards" ? wantsBoards : s.target_exam === targetExam || s.target_exam === "ALL");
        const scheduleIds = studentSchedules.map((s) => s.id);
        if (scheduleIds.length > 0) {
          const { data: shifts } = await supabase.from("exam_shifts").select("*").in("exam_schedule_id", scheduleIds);
          if (shifts) {
            shifts.forEach((sh) => {
              if (!sMap[sh.exam_schedule_id]) sMap[sh.exam_schedule_id] = [];
              sMap[sh.exam_schedule_id].push(sh);
            });
            setShiftsMap(sMap);
          }
        }
      }
      setExamSchedules(studentSchedules);

      let calcMins = 0, calcSplit = { theory: 0, practice: 0, revision: 0, verified: 0 };
      if (pastLogsRes.data) {
        const todayLog = pastLogsRes.data.find((l) => l.log_date === todayStr);
        calcMins = todayLog?.study_time_minutes || 0;
        calcSplit = { theory: todayLog?.theory_minutes || 0, practice: todayLog?.practice_minutes || 0, revision: todayLog?.revision_minutes || 0, verified: todayLog?.verified_minutes || 0 };
        setTodayStudyMins(calcMins); setSplitRatio(calcSplit);
      }

      const allEntries = (qLogsRes.data || []) as QuestionLogEntry[];
      const totalQ = allEntries.reduce((acc, q) => acc + (q.question_count || 0), 0);
      setTotalQuestionsAllTime(totalQ);

      const todayEntries = allEntries.filter((q) => q.log_date === todayStr);
      setTodayQuestionEntries(todayEntries);
      const calcTodayQ = todayEntries.reduce((acc, q) => acc + (q.question_count || 0), 0);
      setTodayQuestions(calcTodayQ);
      const calcAvg = computeTodayAvgQPerHr(todayEntries);
      setTodayAvgQPerHr(calcAvg);

      let recStreak = uProf?.current_streak || 0;
      try { const sInfo = await loadAndReconcileStreak(uid); recStreak = sInfo.currentStreak; } catch (_) {}
      setStreak(recStreak);

      setChapterProgress(progRes.data || []);
      setAllTasks(tasksRes.data || []);
      setScheduledTests(schedTestsRes.data || []);
      setRecentTests(recentTestsRes.data || []);

      setMemCache("full_dashboard_state", {
        user: currentUser, profile: uProf, selectedShiftId: uProf.selected_shift_id || null,
        dailyGoalMins: uProf.daily_goal_minutes || 480, subjects: cleanedSubs, chapters: chapsData,
        distinctSub, initChap, examSchedules: studentSchedules, shiftsMap: sMap,
        todayStudyMins: calcMins, splitRatio: calcSplit, totalQuestionsAllTime: totalQ,
        todayQuestions: calcTodayQ, todayQuestionEntries: todayEntries, todayAvgQPerHr: calcAvg,
        streak: recStreak, chapterProgress: progRes.data || [], allTasks: tasksRes.data || [],
        scheduledTests: schedTestsRes.data || [], recentTests: recentTestsRes.data || [],
      });

      setLoading(false);
    }

    loadData();
    return () => { isCancelled = true; };
  }, [router, todayStr]);

  const distinctSubjectNames = useMemo(() => Array.from(new Set(subjects.map((s) => s.name.trim()))).filter(Boolean), [subjects]);

  const filteredChaptersForSelectedSubject = useMemo(() => {
    if (!selectedDistinctSubject) return chapters;
    const matching = subjects.filter((s) => s.name.trim().toLowerCase() === selectedDistinctSubject.toLowerCase()).map((s) => s.id);
    return chapters.filter((c) => matching.includes(c.subject_id));
  }, [chapters, subjects, selectedDistinctSubject]);

  const handleOpenQuestionModal = () => {
    const now = new Date();
    setQTimeFrom(`${String(now.getHours()).padStart(2, "0")}:00`);
    setQTimeTo(`${String((now.getHours() + 1) % 24).padStart(2, "0")}:00`);
    setQLogDate(now.toISOString().split("T")[0]);
    setQTopicName(""); setQCount("30"); setQStartFrom("1"); setQEndOn("30");
    setQuestionConflictWarning(null);
    setShowAddQuestionModal(true);
  };

  const checkConflict = useCallback((newFrom: string, newTo: string, newDate: string): string | null => {
    const sameDay = todayQuestionEntries.filter((e) => e.log_date === newDate);
    for (const e of sameDay) {
      if (timeRangesOverlap(newFrom, newTo, e.time_from, e.time_to)) {
        return `Time overlap with "${e.topic_name || "previous entry"}" (${e.time_from || "?"} – ${e.time_to || "?"}). Alag time range use karo.`;
      }
    }
    return null;
  }, [todayQuestionEntries]);

  const handleSaveQuestionLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || savingQuestion) return;
    setQuestionConflictWarning(null);

    const fromMins = timeToMinutes(qTimeFrom);
    const toMins = timeToMinutes(qTimeTo);
    if (fromMins !== null && toMins !== null && toMins <= fromMins) {
      setQuestionConflictWarning("To time must be after From time.");
      return;
    }

    if (qTimeFrom && qTimeTo) {
      const conflict = checkConflict(qTimeFrom, qTimeTo, qLogDate);
      if (conflict) { setQuestionConflictWarning(conflict); return; }
    }

    setSavingQuestion(true);
    const count = parseInt(qCount) || 0;
    const selectedChap = chapters.find((c) => c.id === qChapterId);
    const matchingSubjectId = selectedChap?.subject_id || subjects.find((s) => s.name.trim().toLowerCase() === selectedDistinctSubject.toLowerCase())?.id || null;

    try {
      const { data, error } = await supabase.from("question_logs").insert({
        user_id: user.id, log_date: qLogDate, subject_id: matchingSubjectId, chapter_id: qChapterId || null,
        topic_name: qTopicName.trim(), question_count: count, start_from: qStartFrom ? parseInt(qStartFrom) : null,
        end_on: qEndOn ? parseInt(qEndOn) : null, time_from: qTimeFrom || null, time_to: qTimeTo || null, source: "manual",
      }).select().single();

      if (!error && data) {
        const newEntry = data as QuestionLogEntry;
        if (qLogDate === todayStr) {
          setTodayQuestions((p) => p + count);
          const updated = [newEntry, ...todayQuestionEntries];
          setTodayQuestionEntries(updated);
          setTodayAvgQPerHr(computeTodayAvgQPerHr(updated));
        }
        setTotalQuestionsAllTime((p) => p + count);
        setShowAddQuestionModal(false);
      }
    } finally { setSavingQuestion(false); }
  };

  const studentName = profile?.name || user?.user_metadata?.full_name || "Champion";
  const firstName = studentName.split(" ")[0];
  const todayHours = (todayStudyMins / 60).toFixed(1);
  const sumSplit = splitRatio.theory + splitRatio.practice + splitRatio.revision;
  const totalSplitMins = sumSplit > 0 ? sumSplit : 1;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white p-6">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl shadow-lg mb-4 animate-pulse">⚡</div>
        <h2 className="text-base font-black">PrepWise Cockpit</h2>
        <p className="text-xs text-slate-400 mt-1">Starting engine…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28 text-[#0F172A] font-sans antialiased smooth-scroll">
      <AppHeader />
      <main className="max-w-md mx-auto px-4 pt-3.5 space-y-3">
        <HeroWidget name={firstName} streak={streak} todayStudyMins={todayStudyMins} dailyGoalMins={dailyGoalMins} onGoalSaved={(m: number) => { setDailyGoalMins(m); if (user?.id) supabase.from("users").update({ daily_goal_minutes: m }).eq("uid", user.id); }} />

        {/* Exam Countdown */}
        <div className={`grid gap-2 ${examSchedules.length === 1 ? "grid-cols-1" : examSchedules.length === 2 ? "grid-cols-2" : examSchedules.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {examSchedules.map((exam) => {
            const days = Math.max(0, Math.ceil((new Date(exam.exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
            const shifts = shiftsMap[exam.id] || [];
            return (
              <div key={exam.id} className="rounded-2xl p-2.5 bg-gradient-to-b from-[#0B132B] to-[#162238] text-white shadow-md border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[9px] font-black uppercase text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded-md truncate max-w-[70%]">{exam.label}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">{exam.is_confirmed ? "Official" : "Proj."}</span>
                </div>
                <div className="flex flex-col items-center justify-center my-1 bg-black/30 rounded-xl py-2 border border-white/5">
                  <div className="text-2xl font-black text-amber-400 leading-none">{days}</div>
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">DAYS LEFT</span>
                </div>
                <span className="text-[10px] font-bold text-slate-300 text-center">📅 {new Date(exam.exam_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              </div>
            );
          })}
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => router.push("/focus")} className="bg-white p-3 rounded-2xl border border-slate-200/90 text-left active:scale-[0.98] transition-all shadow-2xs">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Today Study</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">{todayHours}<span className="text-xs font-semibold text-slate-500 ml-0.5">h</span></div>
            <span className="text-[10px] font-bold text-teal block mt-0.5">Study Timer →</span>
          </button>

          {/* Redesigned Questions Box */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-bold text-slate-600">Questions Today</span>
                <button type="button" onClick={handleOpenQuestionModal} className="text-[9.5px] font-black text-teal bg-teal/10 px-1.5 py-0.5 rounded border border-teal/20 hover:bg-teal/20">+Add</button>
              </div>
              <div className="flex items-end gap-1.5 mt-0.5">
                <span className="text-lg font-black text-slate-900 tracking-tight leading-none">{todayQuestions}</span>
                {todayAvgQPerHr > 0 && <span className="text-[10px] font-bold text-indigo-600 leading-none mb-0.5 whitespace-nowrap">{todayAvgQPerHr} Q/h</span>}
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-100">
              <span className="text-[9px] font-semibold text-slate-400">All time: <span className="font-bold text-slate-600">{totalQuestionsAllTime}</span></span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Tasks</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">{allTasks.length}</div>
            <span className={`text-[10px] font-bold block mt-0.5 ${allTasks.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>{allTasks.length > 0 ? "Pending" : "All Done ✓"}</span>
          </div>
        </div>

        {/* Study Split */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="text-xs font-black text-slate-900 mb-2.5">⚖️ Today's Study Split</div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex mb-2.5">
            <div style={{ width: `${Math.round((splitRatio.theory / totalSplitMins) * 100)}%` }} className="bg-amber-500" />
            <div style={{ width: `${Math.round((splitRatio.practice / totalSplitMins) * 100)}%` }} className="bg-teal" />
            <div style={{ width: `${Math.round((splitRatio.revision / totalSplitMins) * 100)}%` }} className="bg-indigo-600" />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
            <span className="text-amber-800">Theory ({splitRatio.theory}m)</span>
            <span className="text-teal-800">Practice ({splitRatio.practice}m)</span>
            <span className="text-indigo-800">Revision ({splitRatio.revision}m)</span>
          </div>
        </div>
      </main>

      {/* Question Logging Modal */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-300 overflow-hidden flex flex-col max-h-[92vh] shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <h3 className="text-sm font-black text-slate-900">✏️ Log Questions Solved</h3>
              <button type="button" onClick={() => setShowAddQuestionModal(false)} className="w-7 h-7 rounded-full text-slate-500 hover:bg-slate-200 text-sm font-bold">✕</button>
            </div>
            {todayQuestionEntries.length > 0 && (
              <div className="p-3 bg-slate-100/80 border-b border-slate-200 text-xs shrink-0 max-h-20 overflow-y-auto">
                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1">Today's Entries</span>
                {todayQuestionEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px] font-bold mb-1">
                    <span className="truncate">{e.topic_name || "Practice"} {e.time_from && `(${e.time_from}-${e.time_to})`}</span>
                    <span className="text-teal ml-1">+{e.question_count} Qs</span>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSaveQuestionLog} className="p-4 space-y-3 overflow-y-auto text-xs">
              {questionConflictWarning && <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-700">⚠️ {questionConflictWarning}</div>}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Date</label>
                <input type="date" value={qLogDate} onChange={(e) => setQLogDate(e.target.value)} max={todayStr} className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5">From</label>
                  <input type="time" value={qTimeFrom} onChange={(e) => setQTimeFrom(e.target.value)} className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5">To</label>
                  <input type="time" value={qTimeTo} onChange={(e) => setQTimeTo(e.target.value)} className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Subject</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {distinctSubjectNames.map((n) => (
                    <button key={n} type="button" onClick={() => setSelectedDistinctSubject(n)} className={`py-1.5 rounded-xl border text-xs font-bold ${selectedDistinctSubject.toLowerCase() === n.toLowerCase() ? "bg-slate-900 text-white" : "bg-white text-slate-700"}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Chapter</label>
                <select value={qChapterId} onChange={(e) => setQChapterId(e.target.value)} className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold">
                  {filteredChaptersForSelectedSubject.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Topic / DPP</label>
                <input type="text" value={qTopicName} onChange={(e) => setQTopicName(e.target.value)} placeholder="e.g. Kinematics DPP 1" className="w-full p-2 border border-slate-300 rounded-xl text-xs" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-700 uppercase mb-0.5">Total Qs</label>
                  <input type="number" min="1" value={qCount} onChange={(e) => setQCount(e.target.value)} required className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold text-center" />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-700 uppercase mb-0.5">From #</label>
                  <input type="number" value={qStartFrom} onChange={(e) => setQStartFrom(e.target.value)} className="w-full p-2 border border-slate-300 rounded-xl text-xs text-center" />
                </div>
                <div>
                  <label className="block text-[9px] font-extrabold text-slate-700 uppercase mb-0.5">To #</label>
                  <input type="number" value={qEndOn} onChange={(e) => setQEndOn(e.target.value)} className="w-full p-2 border border-slate-300 rounded-xl text-xs text-center" />
                </div>
              </div>
              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setShowAddQuestionModal(false)} className="flex-1 py-2.5 rounded-xl border border-slate-300 font-black text-xs">Cancel</button>
                <button type="submit" disabled={savingQuestion} className="flex-1 py-2.5 rounded-xl bg-teal text-white font-black text-xs">{savingQuestion ? "Saving…" : "Save Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
