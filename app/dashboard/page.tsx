// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import { loadAndReconcileStreak } from "@/lib/focus";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/BottomNav";
import AiMentorCard from "@/components/dashboard/AiMentorCard";
import AiChatSheet from "@/components/dashboard/AiChatSheet";
import { optimizeMediaUrl } from "@/lib/cloudinary";

declare global {
  interface Window {
    AppBridge?: {
      postMessage: (message: string) => void;
    };
    onNativeFCMToken?: (token: string) => void;
    onNativeFocusSessionLogged?: (mins: number) => void;
    onDirectLoggedSession?: (data: any) => void;
  }
}

// ─── HIGH-SPEED SWR IN-MEMORY CACHE ───
const CACHE_TTL_MS = 1 * 60 * 1000;
const globalMemoryCache: Record<string, { timestamp: number; data: any }> = {};

function getMemCache<T>(key: string): T | null {
  const item = globalMemoryCache[key];
  if (item && Date.now() - item.timestamp < CACHE_TTL_MS) {
    return item.data as T;
  }
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
  try {
    localStorage.setItem(`pw_cache_${key}`, JSON.stringify(payload));
  } catch (_) {}
}

interface ExamScheduleItem {
  id: string;
  exam_key: string;
  label: string;
  target_exam: string;
  year: number;
  exam_date: string;
  is_confirmed: boolean;
}

interface ExamShift {
  id: string;
  exam_schedule_id: string;
  shift_date: string;
  shift_time: string;
}

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  task_type?: string;
  due_date?: string;
}

interface ScheduledTest {
  id: string;
  test_name: string;
  scheduled_date: string;
  subject?: string;
  status: string;
}

interface TestLog {
  id: string;
  test_name: string;
  total_marks: number;
  max_marks: number;
  accuracy: number;
  test_date: string;
}

interface SubjectItem {
  id: string;
  name: string;
  class_level: string;
  target_exam?: string;
}

interface ChapterItem {
  id: string;
  title: string;
  subject_id: string;
}

interface DailyLogItem {
  log_date: string;
  study_time_minutes: number;
  theory_minutes?: number;
  practice_minutes?: number;
  revision_minutes?: number;
  verified_minutes?: number;
}

interface QuestionLogEntry {
  id: string;
  subject_id: string;
  chapter_id: string;
  question_count: number;
  topic_name?: string;
  start_from?: number;
  end_on?: number;
  log_date: string;
  time_from?: string | null;
  time_to?: string | null;
  source?: string | null;
}

interface ContentCardItem {
  id: string;
  quote: string;
  quote_source?: "human" | "anime";
  character: string;
  show: string;
  icon_or_sticker: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  badge: string;
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

// Odd Days = Human first, Even Days = Anime first
function getTodayQuoteSource(): "human" | "anime" {
  const day = new Date().getDate();
  return day % 2 === 1 ? "human" : "anime";
}

// Interleave Human and Anime quotes so every card alternates (Human -> Anime -> Human -> Anime)
function getAlternatingDeck(deck: ContentCardItem[], startWith: "human" | "anime" = "human"): ContentCardItem[] {
  const humans = deck.filter((c) => c.quote_source === "human");
  const animes = deck.filter((c) => c.quote_source === "anime");
  if (humans.length === 0) return animes;
  if (animes.length === 0) return humans;

  const result: ContentCardItem[] = [];
  const primary = startWith === "human" ? humans : animes;
  const secondary = startWith === "human" ? animes : humans;
  const maxLen = Math.max(primary.length, secondary.length);

  for (let i = 0; i < maxLen; i++) {
    if (i < primary.length) result.push(primary[i]);
    if (i < secondary.length) result.push(secondary[i]);
  }
  return result;
}

interface DailyContentState {
  motivationIndex: number;
  memeIndex: number;
  motivationCount: number;
  memeCount: number;
  selectedMotivationId: string;
  selectedMemeId: string;
}

function loadDailyContentState(): DailyContentState {
  try {
    const raw = localStorage.getItem(getTodayKey());
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { motivationIndex: 0, memeIndex: 0, motivationCount: 0, memeCount: 0, selectedMotivationId: "", selectedMemeId: "" };
}

function saveDailyContentState(state: DailyContentState): void {
  try {
    localStorage.setItem(getTodayKey(), JSON.stringify(state));
  } catch (_) {}
}

function getDailyIndex(deckLength: number, salt: string): number {
  if (!deckLength) return 0;
  const dateStr = new Date().toISOString().split("T")[0];
  const str = dateStr + salt;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash) % deckLength;
}

const FALLBACK_MOTIVATION_QUOTES: ContentCardItem[] = [
  {
    id: "m-1",
    quote: "Dream is not that which you see while sleeping, it is something that does not let you sleep.",
    quote_source: "human",
    character: "Dr. A.P.J. Abdul Kalam",
    show: "Wings of Fire",
    icon_or_sticker: "/Qamine/images.jpeg",
    color: "from-sky-500 to-indigo-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-950",
    badge: "bg-sky-500",
  },
  {
    id: "m-2",
    quote: "Hard work is worthless for those that don't believe in themselves.",
    quote_source: "anime",
    character: "Naruto Uzumaki",
    show: "Naruto Shippuden",
    icon_or_sticker: "/Qamine/naruto-naruto-shippuden.gif",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-950",
    badge: "bg-amber-500",
  },
];

const FALLBACK_MEME_QUOTES: ContentCardItem[] = [
  {
    id: "meme-1",
    quote: "PAKAD PAKAD PAKAD... Isne aaj tak numericals solve nahi kiye! Daya, iska phone tod do! 😂",
    quote_source: "human",
    character: "ACP Pradyuman",
    show: "CID (Meme Edition)",
    icon_or_sticker: "👮",
    color: "from-gray-600 to-gray-800",
    bg: "bg-gray-50",
    border: "border-gray-300",
    text: "text-gray-950",
    badge: "bg-gray-600",
  },
];

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
  if (totalMinutes <= 0) return 0;
  return Math.round((totalQs / totalMinutes) * 60);
}

function timeRangesOverlap(
  aFrom: string | null | undefined,
  aTo: string | null | undefined,
  bFrom: string | null | undefined,
  bTo: string | null | undefined
): boolean {
  const af = timeToMinutes(aFrom);
  const at = timeToMinutes(aTo);
  const bf = timeToMinutes(bFrom);
  const bt = timeToMinutes(bTo);
  if (af === null || at === null || bf === null || bt === null) return false;
  return af < bt && bf < at;
}

// Media renderer helper with auto-correction for /Qanime/ -> /Qamine/
function renderMediaSource(url: string): string {
  if (!url) return "";
  let cleanUrl = url;
  if (cleanUrl.startsWith("/Qanime/")) {
    cleanUrl = cleanUrl.replace("/Qanime/", "/Qamine/");
  }
  if (cleanUrl.startsWith("/")) return cleanUrl; // Relative local public folder
  return optimizeMediaUrl(cleanUrl, 180);
}

function HeroWidget({
  name,
  streak,
  todayStudyMins,
  dailyGoalMins,
  onGoalSaved,
}: {
  name: string;
  streak: number;
  todayStudyMins: number;
  dailyGoalMins: number;
  onGoalSaved: (mins: number) => void;
}) {
  const [hour, setHour] = useState(() => new Date().getHours());
  const [mode, setMode] = useState<"motivation" | "meme">(() => {
    try { return (localStorage.getItem("pw_content_mode") as "motivation" | "meme") || "motivation"; } catch { return "motivation"; }
  });
  
  const [dbItems, setDbItems] = useState<Record<string, ContentCardItem[]>>(() => {
    const cached = getMemCache<Record<string, ContentCardItem[]>>("daily_content_deck");
    return cached || { motivation: FALLBACK_MOTIVATION_QUOTES, meme: FALLBACK_MEME_QUOTES };
  });

  const [currentItem, setCurrentItem] = useState<ContentCardItem | null>(null);
  const [imgKey, setImgKey] = useState(0);
  const [showGoalPopup, setShowGoalPopup] = useState(false);
  const [goalHours, setGoalHours] = useState(Math.round(dailyGoalMins / 60) || 8);
  const [dailyState, setDailyState] = useState<DailyContentState>(() => loadDailyContentState());
  const [limitHit, setLimitHit] = useState(false);
  const limitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchDynamicContent() {
      try {
        const { data: tsData } = await supabase
          .from("daily_content")
          .select("created_at")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const latestTs = tsData?.created_at ?? null;
        const cachedTs = localStorage.getItem("pw_content_ts");

        if (latestTs && cachedTs === latestTs) {
          const cached = getMemCache<Record<string, ContentCardItem[]>>("daily_content_deck");
          if (cached) {
            setDbItems(cached);
            return;
          }
        }

        const { data, error } = await supabase.from("daily_content").select("*").eq("is_active", true);
        if (!error && data && data.length > 0) {
          const mList: ContentCardItem[] = [];
          const rList: ContentCardItem[] = [];
          data.forEach((row: any, idx: number) => {
            const fallbackPreset = COLOR_PRESETS[idx % COLOR_PRESETS.length];
            const item: ContentCardItem = {
              id: row.id,
              quote: row.quote,
              quote_source: (row.quote_source as "human" | "anime") || "human",
              character: row.character,
              show: row.show || "PrepWise",
              icon_or_sticker: row.icon_or_sticker || "⚡",
              color: row.gradient_color || fallbackPreset.color,
              bg: row.bg_color || fallbackPreset.bg,
              border: row.border_color || fallbackPreset.border,
              text: row.text_color || fallbackPreset.text,
              badge: row.badge_color || fallbackPreset.badge,
            };
            if (row.content_type === "meme") rList.push(item);
            else mList.push(item);
          });
          const deck = {
            motivation: mList.length > 0 ? mList : FALLBACK_MOTIVATION_QUOTES,
            meme: rList.length > 0 ? rList : FALLBACK_MEME_QUOTES,
          };
          setDbItems(deck);
          setMemCache("daily_content_deck", deck);
          if (latestTs) localStorage.setItem("pw_content_ts", latestTs);
        }
      } catch (_) {}
    }
    fetchDynamicContent();
  }, []);

  useEffect(() => {
    const rawMotDeck = dbItems.motivation.length > 0 ? dbItems.motivation : FALLBACK_MOTIVATION_QUOTES;
    const memDeck = dbItems.meme.length > 0 ? dbItems.meme : FALLBACK_MEME_QUOTES;
    const saved = loadDailyContentState();

    if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
    setLimitHit(false);

    if (mode === "motivation") {
      // Interleaved Alternation: Guaranteed alternating sequence on every tap
      const todaySource = getTodayQuoteSource();
      const motDeck = getAlternatingDeck(rawMotDeck, todaySource);

      let item = motDeck.find((c) => c.id === saved.selectedMotivationId);
      if (!item) {
        const idx = getDailyIndex(motDeck.length, `motivation_${todaySource}`);
        item = motDeck[idx] || motDeck[0];
        const next: DailyContentState = { ...saved, motivationIndex: idx, selectedMotivationId: item.id };
        setDailyState(next);
        saveDailyContentState(next);
      }
      setCurrentItem(item || null);
      setImgKey((k) => k + 1);
    } else {
      let item = memDeck.find((c) => c.id === saved.selectedMemeId);
      if (!item) {
        const idx = getDailyIndex(memDeck.length, "meme");
        item = memDeck[idx] || memDeck[0];
        const next: DailyContentState = { ...saved, memeIndex: idx, selectedMemeId: item.id };
        setDailyState(next);
        saveDailyContentState(next);
      }
      setCurrentItem(item || null);
      setImgKey((k) => k + 1);
    }
  }, [dbItems, mode]);

  const handleTapCard = useCallback(() => {
    const rawMotDeck = dbItems.motivation.length > 0 ? dbItems.motivation : FALLBACK_MOTIVATION_QUOTES;
    const memDeck = dbItems.meme.length > 0 ? dbItems.meme : FALLBACK_MEME_QUOTES;
    const saved = loadDailyContentState();

    const showLimit = () => {
      setLimitHit(true);
      if (limitTimerRef.current) clearTimeout(limitTimerRef.current);
      limitTimerRef.current = setTimeout(() => setLimitHit(false), 3000);
    };

    if (mode === "motivation") {
      const todaySource = getTodayQuoteSource();
      const motDeck = getAlternatingDeck(rawMotDeck, todaySource);

      if (saved.motivationCount >= QUOTE_LIMIT) { showLimit(); return; }
      const newCount = saved.motivationCount + 1;
      const nextIdx = (saved.motivationIndex + 1) % motDeck.length;
      const nextItem = motDeck[nextIdx] || motDeck[0];
      const next: DailyContentState = { ...saved, motivationIndex: nextIdx, motivationCount: newCount, selectedMotivationId: nextItem.id };
      setDailyState(next);
      saveDailyContentState(next);
      setCurrentItem(nextItem);
      setImgKey((k) => k + 1);
      if (newCount >= QUOTE_LIMIT) showLimit();
    } else {
      if (saved.memeCount >= MEME_LIMIT) { showLimit(); return; }
      const newCount = saved.memeCount + 1;
      const nextIdx = (saved.memeIndex + 1) % memDeck.length;
      const nextItem = memDeck[nextIdx] || memDeck[0];
      const next: DailyContentState = { ...saved, memeIndex: nextIdx, memeCount: newCount, selectedMemeId: nextItem.id };
      setDailyState(next);
      saveDailyContentState(next);
      setCurrentItem(nextItem);
      setImgKey((k) => k + 1);
      if (newCount >= MEME_LIMIT) showLimit();
    }
  }, [dbItems, mode]);

  const greeting = getGreeting(name, hour);
  const todayHours = (todayStudyMins / 60).toFixed(1);
  const goalHoursDisplay = (dailyGoalMins / 60).toFixed(0);
  const goalReached = todayStudyMins >= dailyGoalMins && dailyGoalMins > 0;

  const handleSaveGoal = async () => {
    const mins = goalHours * 60;
    onGoalSaved(mins);
    setShowGoalPopup(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-2xs">
      <div className={`h-1 w-full bg-gradient-to-r ${currentItem?.color || "from-indigo-500 to-teal-500"}`} />
      <div className="p-3 pb-2.5">
        {/* Greeting + Streak */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-0.5">
              PrepWise Cockpit
            </p>
            <h2 className="text-xs font-black text-slate-900 leading-snug truncate">{greeting}</h2>
          </div>
          <div
            className={`shrink-0 flex items-center gap-1 rounded-xl px-2.5 py-1.5 ${
              streak > 0 ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-200"
            }`}
          >
            <span className="text-sm leading-none">{streak > 0 ? "🔥" : "💤"}</span>
            <span className={`text-sm font-black leading-none ${streak > 0 ? "text-orange-600" : "text-slate-400"}`}>
              {streak}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase">{streak === 1 ? "Day" : "Days"}</span>
          </div>
        </div>

        {/* Today + Goal Side-by-Side Boxes */}
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`flex-1 border rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 ${
              goalReached ? "bg-emerald-50 border-emerald-200" : "bg-teal-50 border-teal-100"
            }`}
          >
            <span className="text-sm">{goalReached ? "🎯" : "⏱️"}</span>
            <div>
              <p className={`text-[9px] font-bold leading-none ${goalReached ? "text-emerald-600" : "text-teal-600"}`}>
                {goalReached ? "Goal Reached!" : "Today"}
              </p>
              <p className={`text-xs font-black leading-tight ${goalReached ? "text-emerald-900" : "text-teal-900"}`}>
                {todayHours}h studied
              </p>
            </div>
          </div>
          <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl px-2.5 py-1.5 flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🎯</span>
              <div>
                <p className="text-[9px] font-bold text-indigo-600 leading-none">Goal</p>
                <p className="text-xs font-black text-indigo-900 leading-tight">{goalHoursDisplay}h / day</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setGoalHours(Math.round(dailyGoalMins / 60) || 8);
                setShowGoalPopup(true);
              }}
              className="text-[9px] font-black text-indigo-600 bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded-lg hover:bg-indigo-200 shrink-0"
            >
              Edit
            </button>
          </div>
        </div>

        {/* Goal Edit Popup */}
        {showGoalPopup && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 w-full max-w-xs">
              <h3 className="text-sm font-black text-slate-900 mb-1">Set Daily Study Goal</h3>
              <p className="text-[10px] text-slate-500 font-semibold mb-3">Choose your target study hours per day</p>
              <div className="grid grid-cols-4 gap-2 mb-4 max-h-60 overflow-y-auto pr-1">
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setGoalHours(h)}
                    className={`py-2 rounded-xl text-xs font-black border transition-all ${
                      goalHours === h
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoalPopup(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-black text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGoal}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white font-black text-xs shadow-md"
                >
                  Save Goal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Motivation / Meme Switcher */}
        <div className="w-full p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-black flex items-center mb-2.5">
          <button
            type="button"
            onClick={() => { setMode("motivation"); try { localStorage.setItem("pw_content_mode", "motivation"); } catch (_) {} }}
            className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
              mode === "motivation" ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>🔥</span> Motivation
          </button>
          <button
            type="button"
            onClick={() => { setMode("meme"); try { localStorage.setItem("pw_content_mode", "meme"); } catch (_) {} }}
            className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
              mode === "meme" ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>😂</span> Memes
          </button>
        </div>

        {currentItem && (
          <button
            type="button"
            onClick={handleTapCard}
            className={`w-full text-left rounded-2xl border ${currentItem.border} ${currentItem.bg} p-3 active:scale-[0.98] transition-all relative overflow-hidden group shadow-2xs`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center ${currentItem.badge} overflow-hidden`}
              >
                {currentItem.icon_or_sticker &&
                (currentItem.icon_or_sticker.startsWith("http") || currentItem.icon_or_sticker.startsWith("/")) ? (
                  <img
                    key={imgKey}
                    src={renderMediaSource(currentItem.icon_or_sticker)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover rounded-2xl"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-3xl">{currentItem.icon_or_sticker || "💡"}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${currentItem.text} leading-snug`}>"{currentItem.quote}"</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
                  <p className="text-[10px] font-black text-slate-600 truncate">— {currentItem.character}</p>
                  <span className="text-[9.5px] font-bold text-slate-500 bg-white/90 border border-slate-200/90 px-1.5 py-0.5 rounded-full shrink-0">
                    Tap ↻
                  </span>
                </div>
              </div>
            </div>
          </button>
        )}

        {limitHit && (
          <p className="mt-1.5 text-center text-[10px] font-bold text-red-500">
            {mode === "motivation"
              ? `Only ${QUOTE_LIMIT} quotes per day — come back tomorrow! 🌅`
              : `Only ${MEME_LIMIT} memes per day — back to books! 📚`}
            {" · "}
            <span className="underline underline-offset-2 cursor-pointer">Upgrade for more</span>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── SYLLABUS COMPLETION WIDGET ───
function SyllabusCompletionWidget({
  subjects,
  chapters,
  progress,
  onOpenSyllabus,
}: {
  subjects: SubjectItem[];
  chapters: ChapterItem[];
  progress: { chapter_id: string; status: string }[];
  onOpenSyllabus: () => void;
}) {
  const doneSet = useMemo(() => {
    const s = new Set<string>();
    progress.forEach((p) => {
      if (p.status === "done" || p.status === "completed") s.add(p.chapter_id);
    });
    return s;
  }, [progress]);

  const stats = useMemo(() => {
    const groups: Record<string, { name: string; done: number; total: number; color: string }> = {};
    const colorMap: Record<string, string> = {
      physics: "#3b82f6",
      chemistry: "#10b981",
      maths: "#a855f7",
      mathematics: "#a855f7",
      biology: "#14b8a6",
    };
    let grandDone = 0;
    let grandTotal = 0;
    subjects.forEach((subj) => {
      if (!subj.name || !subj.name.trim()) return;
      const cleanName = subj.name.trim();
      const normKey = cleanName.toLowerCase();
      const chaps = chapters.filter((c) => c.subject_id === subj.id);
      const doneCount = chaps.filter((c) => doneSet.has(c.id)).length;
      const totalCount = chaps.length;
      if (!groups[normKey]) {
        groups[normKey] = { name: cleanName, done: 0, total: 0, color: colorMap[normKey] || "#f59e0b" };
      }
      groups[normKey].done += doneCount;
      groups[normKey].total += totalCount;
      grandDone += doneCount;
      grandTotal += totalCount;
    });
    const subjectList = Object.values(groups).map((g) => ({
      name: g.name, done: g.done, total: g.total,
      pct: g.total > 0 ? Math.round((g.done / g.total) * 100) : 0,
      color: g.color,
    }));
    const overallPct = grandTotal > 0 ? Math.round((grandDone / grandTotal) * 100) : 0;
    return { subjectList, overallPct, grandDone, grandTotal };
  }, [subjects, chapters, doneSet]);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
          <span>📚</span> Syllabus Completion
        </h3>
        <span className="text-[10px] font-bold text-teal bg-teal/10 px-2 py-0.5 rounded-md border border-teal/20">
          {stats.grandDone}/{stats.grandTotal} Chapters Done
        </span>
      </div>
      <div className="flex items-center justify-center gap-6 py-2">
        <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} stroke="#e2e8f0" strokeWidth="10" fill="none" />
            {stats.subjectList.map((s) => {
              const segFraction = stats.grandTotal > 0 ? s.done / stats.grandTotal : 0;
              const strokeLength = segFraction * circumference;
              const dasharray = `${strokeLength} ${circumference}`;
              const dashoffset = -accumulatedOffset;
              accumulatedOffset += strokeLength;
              return (
                <circle
                  key={s.name}
                  cx="50" cy="50" r={radius}
                  stroke={s.color} strokeWidth="10" fill="none"
                  strokeDasharray={dasharray} strokeDashoffset={dashoffset}
                  strokeLinecap="round" className="transition-all duration-500"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-black text-slate-900 leading-none">{stats.overallPct}%</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Overall</span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {stats.subjectList.map((s) => (
            <div key={s.name} className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1.5 text-slate-800">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="text-slate-500 text-[10px]">{s.done}/{s.total} ({s.pct}%)</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div style={{ width: `${s.pct}%`, backgroundColor: s.color }} className="h-full rounded-full transition-all" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenSyllabus}
        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-teal font-bold text-xs rounded-xl border border-slate-200 transition-all text-center flex items-center justify-center gap-1"
      >
        <span>Go to Syllabus Tracker</span>
        <span>→</span>
      </button>
    </div>
  );
}

// ─── ACTION ITEMS WIDGET ───
function ActionItemsWidget({
  tasks,
  scheduledTests,
  onCompleteTask,
  onCompleteTest,
  onAddTask,
  onViewAll,
}: {
  tasks: TaskItem[];
  scheduledTests: ScheduledTest[];
  onCompleteTask: (id: string) => void;
  onCompleteTest: (id: string) => void;
  onAddTask: () => void;
  onViewAll: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "todo" | "backlog" | "tests">("all");

  const { items, totalCount } = useMemo(() => {
    let combined: { id: string; title: string; priority: string; itemType: "todo" | "backlog" | "test"; date?: string }[] = [];
    if (filter === "all" || filter === "todo") {
      const todos = tasks.filter((t) => t.task_type !== "backlog").map((t) => ({ id: t.id, title: t.title, priority: t.priority, itemType: "todo" as const, date: t.due_date }));
      combined.push(...todos);
    }
    if (filter === "all" || filter === "backlog") {
      const backlogs = tasks.filter((t) => t.task_type === "backlog").map((t) => ({ id: t.id, title: t.title, priority: t.priority, itemType: "backlog" as const, date: t.due_date }));
      combined.push(...backlogs);
    }
    if (filter === "all" || filter === "tests") {
      const tests = scheduledTests.map((t) => ({ id: t.id, title: t.test_name, priority: "medium", itemType: "test" as const, date: t.scheduled_date }));
      combined.push(...tests);
    }
    return { items: combined.slice(0, 5), totalCount: combined.length };
  }, [tasks, scheduledTests, filter]);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
          <span>📋</span> Action Items
        </h3>
        <button
          type="button"
          onClick={onAddTask}
          className="text-[11px] font-bold text-teal bg-teal/10 hover:bg-teal/20 border border-teal/20 px-2.5 py-1 rounded-lg transition-all"
        >
          + Add Task
        </button>
      </div>
      <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-[10px] font-black">
        {(["all", "todo", "backlog", "tests"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`flex-1 py-1 rounded-lg transition-all capitalize ${
              filter === tab ? "bg-white text-slate-900 shadow-2xs font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {tab === "todo" ? "To-Do" : tab}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-900 font-bold">
          🎉 All caught up! No pending items in this category.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    it.itemType === "test" ? "bg-indigo-600" : it.priority === "high" ? "bg-rose-600" : it.priority === "medium" ? "bg-amber-500" : "bg-emerald-600"
                  }`}
                />
                <div className="truncate">
                  <span className="font-bold text-slate-900 block truncate">{it.title}</span>
                  {it.date && (
                    <span className="text-[9.5px] font-semibold text-slate-500 block">
                      {it.itemType === "test" ? `📅 Scheduled: ${it.date}` : `Target: ${it.date}`}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => (it.itemType === "test" ? onCompleteTest(it.id) : onCompleteTask(it.id))}
                className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-200 active:scale-95 shrink-0"
              >
                Done ✓
              </button>
            </div>
          ))}
        </div>
      )}
      {totalCount > 5 && (
        <button type="button" onClick={onViewAll} className="w-full text-center text-[11px] font-bold text-slate-600 hover:text-slate-900 pt-1 block">
          View All ({totalCount}) →
        </button>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD PAGE ───
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [studentContext, setStudentContext] = useState<any>(null);
  const [doubtOpen, setDoubtOpen] = useState(false);

  const [todayStudyMins, setTodayStudyMins] = useState(0);
  const [dailyGoalMins, setDailyGoalMins] = useState(480);

  const [todayQuestions, setTodayQuestions] = useState(0);
  const [totalQuestionsAllTime, setTotalQuestionsAllTime] = useState(0);
  const [todayAvgQPerHr, setTodayAvgQPerHr] = useState(0);

  const [streak, setStreak] = useState(0);

  const [allPastLogs, setAllPastLogs] = useState<DailyLogItem[]>([]);
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

  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [todayQuestionEntries, setTodayQuestionEntries] = useState<QuestionLogEntry[]>([]);
  const [selectedDistinctSubject, setSelectedDistinctSubject] = useState<string>("");
  const [qChapterId, setQChapterId] = useState("");
  const [qTopicName, setQTopicName] = useState("");
  const [qCount, setQCount] = useState("30");
  const [qStartFrom, setQStartFrom] = useState("1");
  const [qEndOn, setQEndOn] = useState("30");
  const [qTimeFrom, setQTimeFrom] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:00`;
  });
  const [qTimeTo, setQTimeTo] = useState<string>(() => {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    return `${String(later.getHours()).padStart(2, "0")}:00`;
  });
  const [qLogDate, setQLogDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [questionConflictWarning, setQuestionConflictWarning] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      const cached = getMemCache<any>("full_dashboard_state");
      if (cached && !isCancelled) {
        setProfile(cached.profile);
        setUser(cached.user);
        setSelectedShiftId(cached.selectedShiftId);
        setDailyGoalMins(cached.dailyGoalMins);
        setSubjects(cached.subjects || []);
        setChapters(cached.chapters || []);
        if (cached.distinctSub) setSelectedDistinctSubject(cached.distinctSub);
        if (cached.initChap) setQChapterId(cached.initChap);
        setExamSchedules(cached.examSchedules || []);
        setShiftsMap(cached.shiftsMap || {});
        setTodayStudyMins(cached.todayStudyMins || 0);
        setSplitRatio(cached.splitRatio || { theory: 0, practice: 0, revision: 0, verified: 0 });
        setTotalQuestionsAllTime(cached.totalQuestionsAllTime || 0);
        setTodayQuestions(cached.todayQuestions || 0);
        setTodayQuestionEntries(cached.todayQuestionEntries || []);
        setTodayAvgQPerHr(cached.todayAvgQPerHr || 0);
        setStreak(cached.streak || 0);
        setChapterProgress(cached.chapterProgress || []);
        setAllTasks(cached.allTasks || []);
        setScheduledTests(cached.scheduledTests || []);
        setRecentTests(cached.recentTests || []);
        setLoading(false);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cached) router.push("/");
        return;
      }
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

      const [
        subjectsRes,
        schedulesRes,
        pastLogsRes,
        qLogsRes,
        progRes,
        tasksRes,
        schedTestsRes,
        recentTestsRes,
      ] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name, class_level, target_exam")
          .in("class_level", allowedClasses.length ? allowedClasses : ["11", "12"]),
        supabase
          .from("exam_schedule")
          .select("*")
          .eq("year", targetYear)
          .order("display_order", { ascending: true }),
        supabase
          .from("daily_logs")
          .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, verified_minutes, streak_count, log_date")
          .eq("user_id", uid)
          .order("log_date", { ascending: false })
          .limit(84),
        supabase
          .from("question_logs")
          .select("id, question_count, log_date, topic_name, start_from, end_on, subject_id, chapter_id, time_from, time_to, source")
          .eq("user_id", uid)
          .order("log_date", { ascending: false }),
        supabase
          .from("chapter_progress")
          .select("chapter_id, status")
          .eq("user_id", uid),
        supabase
          .from("tasks")
          .select("id, title, priority, status, task_type, due_date")
          .eq("user_id", uid)
          .neq("status", "completed")
          .order("created_at", { ascending: false }),
        supabase
          .from("test_schedule")
          .select("id, test_name, scheduled_date, subject, status")
          .eq("user_id", uid)
          .eq("status", "upcoming")
          .order("scheduled_date", { ascending: true })
          .limit(5),
        supabase
          .from("test_logs")
          .select("id, test_name, total_marks, max_marks, accuracy, test_date")
          .eq("user_id", uid)
          .order("test_date", { ascending: false })
          .limit(2),
      ]);

      if (isCancelled) return;

      let cleanedSubs: SubjectItem[] = [];
      let chapsData: ChapterItem[] = [];
      let distinctSub = "";
      let initChap = "";

      if (subjectsRes.data) {
        cleanedSubs = subjectsRes.data.filter((s) => {
          if (!s.name || !s.name.trim()) return false;
          const norm = s.name.trim().toLowerCase();
          if (targetExam === "JEE") {
            if (norm.includes("bio") || s.target_exam === "NEET") return false;
          } else if (targetExam === "NEET") {
            if (norm.includes("math") || s.target_exam === "JEE") return false;
          }
          return true;
        });

        setSubjects(cleanedSubs);
        const distinctNames = Array.from(new Set(cleanedSubs.map((s) => s.name.trim())));
        distinctSub = distinctNames[0] || "";
        if (distinctSub) setSelectedDistinctSubject(distinctSub);

        const subIds = cleanedSubs.map((s) => s.id);
        if (subIds.length > 0) {
          let chapQuery = supabase
            .from("chapters")
            .select("id, title, subject_id, in_competitive_syllabus")
            .in("subject_id", subIds)
            .order("display_order", { ascending: true });
          if (isDropper) chapQuery = chapQuery.neq("in_competitive_syllabus", false);
          const { data: chaps } = await chapQuery;
          if (chaps) {
            chapsData = chaps;
            setChapters(chaps);
            const firstActiveSubIds = cleanedSubs
              .filter((s) => s.name.trim().toLowerCase() === distinctSub.toLowerCase())
              .map((s) => s.id);
            const initialChaps = chaps.filter((c) => firstActiveSubIds.includes(c.subject_id));
            if (initialChaps[0]) {
              initChap = initialChaps[0].id;
              setQChapterId(initChap);
            }
          }
        }
      }

      let studentSchedules: ExamScheduleItem[] = [];
      let sMap: Record<string, ExamShift[]> = {};
      if (schedulesRes.data && schedulesRes.data.length > 0) {
        studentSchedules = schedulesRes.data.filter((s) =>
          s.target_exam === "Boards" ? wantsBoards : s.target_exam === targetExam || s.target_exam === "ALL"
        );
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

      let calculatedTodayMins = 0;
      let calculatedSplit = { theory: 0, practice: 0, revision: 0, verified: 0 };
      if (pastLogsRes.data) {
        setAllPastLogs(pastLogsRes.data);
        const todayLog = pastLogsRes.data.find((l) => l.log_date === todayStr);
        calculatedTodayMins = todayLog?.study_time_minutes || 0;
        calculatedSplit = {
          theory: todayLog?.theory_minutes || 0,
          practice: todayLog?.practice_minutes || 0,
          revision: todayLog?.revision_minutes || 0,
          verified: todayLog?.verified_minutes || 0,
        };
        setTodayStudyMins(calculatedTodayMins);
        setSplitRatio(calculatedSplit);
      }

      const allEntries = (qLogsRes.data || []) as QuestionLogEntry[];
      const totalQ = allEntries.reduce((acc, q) => acc + (q.question_count || 0), 0);
      setTotalQuestionsAllTime(totalQ);

      const todayEntries = allEntries.filter((q) => q.log_date === todayStr);
      setTodayQuestionEntries(todayEntries);
      const calculatedTodayQ = todayEntries.reduce((acc, q) => acc + (q.question_count || 0), 0);
      setTodayQuestions(calculatedTodayQ);
      const calculatedAvg = computeTodayAvgQPerHr(todayEntries);
      setTodayAvgQPerHr(calculatedAvg);

      let reconciledStreak = uProf?.current_streak || 0;
      try {
        const sInfo = await loadAndReconcileStreak(uid);
        reconciledStreak = sInfo.currentStreak;
      } catch (_) {}
      setStreak(reconciledStreak);

      const progressData = progRes.data || [];
      const tasksData = tasksRes.data || [];
      const schedTestsData = schedTestsRes.data || [];
      const recentTestsData = recentTestsRes.data || [];

      setChapterProgress(progressData);
      setAllTasks(tasksData);
      setScheduledTests(schedTestsData);
      setRecentTests(recentTestsData);

      setMemCache("full_dashboard_state", {
        user: currentUser,
        profile: uProf,
        selectedShiftId: uProf.selected_shift_id || null,
        dailyGoalMins: uProf.daily_goal_minutes || 480,
        subjects: cleanedSubs,
        chapters: chapsData,
        distinctSub,
        initChap,
        examSchedules: studentSchedules,
        shiftsMap: sMap,
        todayStudyMins: calculatedTodayMins,
        splitRatio: calculatedSplit,
        totalQuestionsAllTime: totalQ,
        todayQuestions: calculatedTodayQ,
        todayQuestionEntries: todayEntries,
        todayAvgQPerHr: calculatedAvg,
        streak: reconciledStreak,
        chapterProgress: progressData,
        allTasks: tasksData,
        scheduledTests: schedTestsData,
        recentTests: recentTestsData,
      });

      setLoading(false);

      try {
        const cachedReport = uProf?.ai_mentor_report;
        const cachedContext = uProf?.ai_student_context;
        if (cachedReport && !isCancelled) {
          setMentorReport(cachedReport);
          if (cachedContext) setStudentContext(cachedContext);
        } else {
          setMentorLoading(true);
          const res = await fetch("/api/ai-mentor", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: uid }),
          });
          if (res.ok && !isCancelled) {
            const data = await res.json();
            setMentorReport(data.report);
            if (data.studentContext) setStudentContext(data.studentContext);
          }
        }
      } catch (_) {
      } finally {
        if (!isCancelled) setMentorLoading(false);
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [router, todayStr]);

  const distinctSubjectNames = useMemo(() => {
    return Array.from(new Set(subjects.map((s) => s.name.trim()))).filter(Boolean);
  }, [subjects]);

  const filteredChaptersForSelectedSubject = useMemo(() => {
    if (!selectedDistinctSubject) return chapters;
    const matchingSubjectIds = subjects
      .filter((s) => s.name.trim().toLowerCase() === selectedDistinctSubject.toLowerCase())
      .map((s) => s.id);
    return chapters.filter((c) => matchingSubjectIds.includes(c.subject_id));
  }, [chapters, subjects, selectedDistinctSubject]);

  const handleSelectDistinctSubject = (name: string) => {
    setSelectedDistinctSubject(name);
    const matchingSubjectIds = subjects
      .filter((s) => s.name.trim().toLowerCase() === name.toLowerCase())
      .map((s) => s.id);
    const chaps = chapters.filter((c) => matchingSubjectIds.includes(c.subject_id));
    if (chaps[0]) setQChapterId(chaps[0].id);
    else setQChapterId("");
  };

  const handleCompleteTask = async (id: string) => {
    setAllTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
  };

  const handleCompleteTest = async (id: string) => {
    setScheduledTests((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("test_schedule").update({ status: "completed" }).eq("id", id);
  };

  const handleOpenQuestionModal = () => {
    const now = new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    setQTimeFrom(`${String(now.getHours()).padStart(2, "0")}:00`);
    setQTimeTo(`${String(later.getHours()).padStart(2, "0")}:00`);
    setQLogDate(now.toISOString().split("T")[0]);
    setQTopicName("");
    setQCount("30");
    setQStartFrom("1");
    setQEndOn("30");
    setQuestionConflictWarning(null);
    setShowAddQuestionModal(true);
  };

  const checkConflict = useCallback((newFrom: string, newTo: string, newDate: string): string | null => {
    const sameDay = todayQuestionEntries.filter((e) => e.log_date === newDate);
    for (const e of sameDay) {
      if (timeRangesOverlap(newFrom, newTo, e.time_from, e.time_to)) {
        const label = e.topic_name || "a previous entry";
        return `Time overlap with "${label}" (${e.time_from || "?"} – ${e.time_to || "?"}). Alag time range use karo.`;
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
      if (conflict) {
        setQuestionConflictWarning(conflict);
        return;
      }
    }

    setSavingQuestion(true);

    const count = parseInt(qCount) || 0;
    const start = qStartFrom ? parseInt(qStartFrom) : null;
    const end = qEndOn ? parseInt(qEndOn) : null;

    const selectedChap = chapters.find((c) => c.id === qChapterId);
    const matchingSubjectId =
      selectedChap?.subject_id ||
      subjects.find((s) => s.name.trim().toLowerCase() === selectedDistinctSubject.toLowerCase())?.id ||
      null;

    try {
      const { data, error } = await supabase
        .from("question_logs")
        .insert({
          user_id: user.id,
          log_date: qLogDate,
          subject_id: matchingSubjectId,
          chapter_id: qChapterId || null,
          topic_name: qTopicName.trim(),
          question_count: count,
          start_from: start,
          end_on: end,
          time_from: qTimeFrom || null,
          time_to: qTimeTo || null,
          source: "manual",
        })
        .select()
        .single();

      if (!error && data) {
        const newEntry = data as QuestionLogEntry;
        const isToday = qLogDate === todayStr;
        if (isToday) {
          setTodayQuestions((prev) => prev + count);
          const updatedEntries = [newEntry, ...todayQuestionEntries];
          setTodayQuestionEntries(updatedEntries);
          setTodayAvgQPerHr(computeTodayAvgQPerHr(updatedEntries));
        }
        setTotalQuestionsAllTime((prev) => prev + count);
        setShowAddQuestionModal(false);
      }
    } finally {
      setSavingQuestion(false);
    }
  };

  const handleGoalSaved = async (mins: number) => {
    setDailyGoalMins(mins);
    if (user?.id) {
      await supabase.from("users").update({ daily_goal_minutes: mins }).eq("uid", user.id);
    }
  };

  const calculateDaysLeft = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white p-6">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl shadow-lg mb-4 animate-pulse">
          ⚡
        </div>
        <h2 className="text-base font-black">PrepWise Cockpit</h2>
        <p className="text-xs text-slate-400 mt-1">Starting engine…</p>
      </div>
    );
  }

  const studentName = profile?.name || user?.user_metadata?.full_name || "Champion";
  const firstName = studentName.split(" ")[0];
  const todayHours = (todayStudyMins / 60).toFixed(1);

  const sumSplit = splitRatio.theory + splitRatio.practice + splitRatio.revision;
  const totalSplitMins = sumSplit > 0 ? sumSplit : 1;
  const theoryPct = Math.round((splitRatio.theory / totalSplitMins) * 100);
  const practicePct = Math.round((splitRatio.practice / totalSplitMins) * 100);
  const revisionPct = Math.round((splitRatio.revision / totalSplitMins) * 100);

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28 text-[#0F172A] font-sans antialiased">
      <main className="max-w-md mx-auto px-4 pt-3.5 space-y-3">
        {/* 1. HERO WIDGET */}
        <HeroWidget
          name={firstName}
          streak={streak}
          todayStudyMins={todayStudyMins}
          dailyGoalMins={dailyGoalMins}
          onGoalSaved={handleGoalSaved}
        />

        {/* 2. EXAM COUNTDOWN */}
        <div
          className={`grid gap-2 ${
            examSchedules.length === 1 ? "grid-cols-1"
            : examSchedules.length === 2 ? "grid-cols-2"
            : examSchedules.length === 3 ? "grid-cols-3"
            : "grid-cols-4"
          }`}
        >
          {examSchedules.map((exam) => {
            const days = calculateDaysLeft(exam.exam_date);
            const shifts = shiftsMap[exam.id] || [];
            const formattedDate = new Date(exam.exam_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
            let cleanLabel = exam.label;
            const norm = cleanLabel.toLowerCase();
            if (norm.includes("session 1") || norm.includes("jan")) cleanLabel = "JEE Main (Jan)";
            else if (norm.includes("session 2") || norm.includes("apr")) cleanLabel = "JEE Main (Apr)";
            else if (norm.includes("advanced")) cleanLabel = "JEE Advanced";

            return (
              <div
                key={exam.id}
                className="rounded-2xl p-2.5 bg-gradient-to-b from-[#0B132B] to-[#162238] text-white shadow-md border border-slate-800 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wide text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded-md border border-amber-400/30 truncate max-w-[70%]">
                    {cleanLabel}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase">
                    {exam.is_confirmed ? "Official" : "Proj."}
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center my-1 bg-black/30 rounded-xl py-2 border border-white/5">
                  <div className="text-2xl font-black text-amber-400 leading-none tracking-tight">{days}</div>
                  <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">DAYS LEFT</span>
                </div>
                <div className="mt-1 pt-1.5 border-t border-white/10 flex flex-col items-center">
                  <span className="text-[10px] font-bold text-slate-300 tracking-wide">📅 {formattedDate}</span>
                  {shifts.length > 0 && (
                    <div className="w-full mt-1.5">
                      <select
                        value={selectedShiftId || ""}
                        onChange={(e) => setSelectedShiftId(e.target.value)}
                        className="w-full bg-slate-800 text-white rounded-lg px-1.5 py-1 border border-slate-700 text-[9px] font-semibold truncate"
                      >
                        <option value="">Select Shift</option>
                        {shifts.map((sh) => (
                          <option key={sh.id} value={sh.id}>{sh.shift_date} ({sh.shift_time})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. AI MENTOR WIDGET */}
        <div className="space-y-2">
          <AiMentorCard
            userId={user?.id}
            targetExam={profile?.target_exam || "JEE"}
            report={mentorReport}
            loading={mentorLoading}
            onRefresh={async () => {
              if (!user?.id) return;
              setMentorLoading(true);
              try {
                const res = await fetch("/api/ai-mentor", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ userId: user.id, forceRefresh: true }),
                });
                if (res.ok) {
                  const data = await res.json();
                  setMentorReport(data.report);
                  if (data.studentContext) setStudentContext(data.studentContext);
                }
              } catch (_) {}
              finally { setMentorLoading(false); }
            }}
            onOpenDoubtSolver={() => setDoubtOpen(true)}
          />

          {/* AI Doubt Solver & Live Video Call Dual Launchpad */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Box 1: Text & Photo AI Doubt Solver */}
            <button
              type="button"
              onClick={() => setDoubtOpen(true)}
              className="relative p-3.5 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 hover:to-teal-900 text-white rounded-2xl border border-teal-500/30 shadow-md active:scale-[0.98] transition-all text-left flex flex-col justify-between group overflow-hidden"
            >
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-teal-500/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-sm shadow-inner">
                    ✨
                  </div>
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-teal-300 bg-teal-500/20 px-2 py-0.5 rounded-full border border-teal-400/30">
                    Text / Photo
                  </span>
                </div>
                <h4 className="text-xs font-black text-white leading-tight mb-1 group-hover:text-teal-200 transition-colors">
                  AI Doubt Solver
                </h4>
                <p className="text-[9.5px] font-medium text-slate-300 leading-relaxed line-clamp-2">
                  Photo upload karo ya type karo — step-by-step NCERT formula & concept solutions pao.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-bold text-teal-300">
                <span>Ask Doubts</span>
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </button>

            {/* Box 2: Live Video AI Doubt Solver (Video Call) */}
            <button
              type="button"
              onClick={() => {
                setDoubtOpen(true);
              }}
              className="relative p-3.5 bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#312E81] hover:to-[#3730A3] text-white rounded-2xl border border-indigo-500/40 shadow-md active:scale-[0.98] transition-all text-left flex flex-col justify-between group overflow-hidden"
            >
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-indigo-500/20 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-sm shadow-inner">
                    📹
                  </div>
                  <span className="flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                    Live 1-on-1
                  </span>
                </div>
                <h4 className="text-xs font-black text-white leading-tight mb-1 group-hover:text-indigo-200 transition-colors">
                  Live Video Call
                </h4>
                <p className="text-[9.5px] font-medium text-indigo-200/90 leading-relaxed line-clamp-2">
                  Hands-free camera on karke book dikhao — AI teacher live aawaz mein real-time samjhaye.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-bold text-indigo-300">
                <span>Start Video Call</span>
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </button>
          </div>
        </div>

        {/* 4. METRICS ROW */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => router.push("/focus")}
            className="bg-white p-3 rounded-2xl border border-slate-200/90 text-left active:scale-[0.98] transition-all hover:border-teal-500 shadow-2xs"
          >
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Today Study</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">
              {todayHours}
              <span className="text-xs font-semibold text-slate-500 ml-0.5">h</span>
            </div>
            <span className="text-[10px] font-bold text-teal block mt-0.5">Study Timer →</span>
          </button>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] font-bold text-slate-600">Questions Today</span>
                <button
                  type="button"
                  onClick={handleOpenQuestionModal}
                  className="text-[9.5px] font-black text-teal bg-teal/10 px-1.5 py-0.5 rounded border border-teal/20 hover:bg-teal/20"
                >
                  +Add
                </button>
              </div>
              <div className="flex items-end gap-1.5 mt-0.5">
                <span className="text-lg font-black text-slate-900 tracking-tight leading-none">{todayQuestions}</span>
                {todayAvgQPerHr > 0 && (
                  <span className="text-[10px] font-bold text-indigo-600 leading-none mb-0.5 whitespace-nowrap">
                    {todayAvgQPerHr} Q/h
                  </span>
                )}
              </div>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-100">
              <span className="text-[9px] font-semibold text-slate-400">
                All time: <span className="font-bold text-slate-600">{totalQuestionsAllTime}</span>
              </span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Tasks</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">{allTasks.length}</div>
            <span className={`text-[10px] font-bold block mt-0.5 ${allTasks.length > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {allTasks.length > 0 ? "Pending" : "All Done ✓"}
            </span>
          </div>
        </div>

        {/* 5. TODAY'S STUDY DISTRIBUTION */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>⚖️</span> Today's Study Split
            </span>
          </div>
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex mb-2.5 shadow-inner">
            <div style={{ width: `${sumSplit > 0 ? theoryPct : 33}%` }} className="bg-amber-500 transition-all" />
            <div style={{ width: `${sumSplit > 0 ? practicePct : 50}%` }} className="bg-teal transition-all" />
            <div style={{ width: `${sumSplit > 0 ? revisionPct : 17}%` }} className="bg-indigo-600 transition-all" />
          </div>
          <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
            <span className="flex items-center gap-1.5 text-amber-800">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Theory ({splitRatio.theory}m)
            </span>
            <span className="flex items-center gap-1.5 text-teal-800">
              <span className="w-2.5 h-2.5 rounded-full bg-teal" /> Practice ({splitRatio.practice}m)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-800">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Revision ({splitRatio.revision}m)
            </span>
          </div>
          {splitRatio.verified > 0 && (
            <div className="mt-2.5 flex items-center gap-2 bg-teal/10 border border-teal/20 rounded-xl px-3 py-2">
              <span className="text-sm">🛡️</span>
              <div className="flex-1">
                <span className="text-[11px] font-bold text-teal">{splitRatio.verified}m Verified (Leaderboard Counted)</span>
                <p className="text-[10px] text-teal/80 mt-0.5">Face cam + App blocker both ON</p>
              </div>
              <span className="text-xs font-black text-teal">
                {Math.round((splitRatio.verified / Math.max(todayStudyMins, 1)) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* 6. SYLLABUS COMPLETION WIDGET */}
        <SyllabusCompletionWidget
          subjects={subjects}
          chapters={chapters}
          progress={chapterProgress}
          onOpenSyllabus={() => router.push("/library")}
        />

        {/* 7. COMBINED ACTION ITEMS */}
        <ActionItemsWidget
          tasks={allTasks}
          scheduledTests={scheduledTests}
          onCompleteTask={handleCompleteTask}
          onCompleteTest={handleCompleteTest}
          onAddTask={() => router.push("/todo")}
          onViewAll={() => router.push("/todo")}
        />

        {/* 8. RECENT MOCK TESTS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>📈</span> Recent Mock Performance
            </span>
            <button type="button" onClick={() => router.push("/tests/analysis")} className="text-[11px] font-bold text-indigo-700 hover:underline">
              View Detailed Analysis →
            </button>
          </div>
          {recentTests.length === 0 ? (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-indigo-950">No Tests Logged</div>
                <div className="text-[10px] font-semibold text-slate-600">Log mock test marks to track accuracy</div>
              </div>
              <button type="button" onClick={() => router.push("/tests")} className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs">
                + Log Score
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTests.slice(0, 2).map((t) => (
                <div key={t.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <div className="font-black text-slate-900 text-xs">{t.test_name}</div>
                    <div className="text-[10px] font-semibold text-slate-500">{t.test_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-sm">{t.total_marks} / {t.max_marks}</div>
                    <div className="text-[10px] font-bold text-teal">
                      Acc: {t.accuracy || Math.round((t.total_marks / t.max_marks) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 9. QUICK ROUTE CARDS */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-2xs active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="text-xl mb-1">📚</div>
            <div>
              <div className="text-xs font-black text-slate-900">Syllabus</div>
              <div className="text-[9px] font-semibold text-slate-500">Chapters & Backlogs</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-2xs active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="text-xl mb-1">📊</div>
            <div>
              <div className="text-xs font-black text-slate-900">Test Hub</div>
              <div className="text-[8.5px] font-semibold text-slate-500 leading-tight">LOG, VIEW & SCHEDULE</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/analytics")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-2xs active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="text-xl mb-1">📈</div>
            <div>
              <div className="text-xs font-black text-slate-900">Analytics</div>
              <div className="text-[9px] font-semibold text-slate-500">Charts & Heatmap</div>
            </div>
          </button>
        </div>
      </main>

      {/* 10. QUESTION LOGGING MODAL */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full border border-slate-300 overflow-hidden flex flex-col max-h-[92vh] shadow-xl">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-teal text-white flex items-center justify-center text-sm shadow-xs font-bold">
                  ✏️
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Log Questions Solved</h3>
                  <p className="text-[10px] font-semibold text-slate-500">Track today's practice velocity</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQuestionModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {todayQuestionEntries.length > 0 && (
              <div className="p-3 bg-slate-100/80 border-b border-slate-200 text-xs shrink-0">
                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Today's Entries</span>
                <div className="space-y-1 max-h-20 overflow-y-auto pr-1">
                  {todayQuestionEntries.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold"
                    >
                      <div className="truncate">
                        <span className="text-slate-800">{e.topic_name || "Practice Session"}</span>
                        {e.time_from && e.time_to && (
                          <span className="ml-1.5 text-slate-400 font-normal text-[9px]">{e.time_from}–{e.time_to}</span>
                        )}
                        {e.source && e.source !== "manual" && (
                          <span className="ml-1 text-[9px] text-indigo-500 font-semibold">[{e.source}]</span>
                        )}
                      </div>
                      <span className="text-teal shrink-0 ml-2">+{e.question_count} Qs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveQuestionLog} className="p-4 space-y-3 overflow-y-auto text-xs">
              {questionConflictWarning && (
                <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-700">
                  ⚠️ {questionConflictWarning}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Date</label>
                <input
                  type="date"
                  value={qLogDate}
                  onChange={(e) => {
                    setQLogDate(e.target.value);
                    setQuestionConflictWarning(null);
                  }}
                  max={todayStr}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Study Time Frame</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 mb-0.5">From</p>
                    <input
                      type="time"
                      value={qTimeFrom}
                      onChange={(e) => {
                        setQTimeFrom(e.target.value);
                        setQuestionConflictWarning(null);
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-slate-500 mb-0.5">To</p>
                    <input
                      type="time"
                      value={qTimeTo}
                      onChange={(e) => {
                        setQTimeTo(e.target.value);
                        setQuestionConflictWarning(null);
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
                {qTimeFrom && qTimeTo && (() => {
                  const f = timeToMinutes(qTimeFrom);
                  const t = timeToMinutes(qTimeTo);
                  if (f !== null && t !== null && t > f) {
                    const dur = t - f;
                    const hrs = Math.floor(dur / 60);
                    const mins = dur % 60;
                    return (
                      <p className="text-[10px] font-bold text-teal mt-1">
                        ⏱ Duration: {hrs > 0 ? `${hrs}h ` : ""}{mins > 0 ? `${mins}m` : ""}
                        {parseInt(qCount) > 0 && (t - f) > 0
                          ? ` · ${Math.round((parseInt(qCount) / (t - f)) * 60)} Q/hr`
                          : ""}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Subject</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {distinctSubjectNames.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectDistinctSubject(name)}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        selectedDistinctSubject.toLowerCase() === name.toLowerCase()
                          ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Chapter</label>
                <select
                  value={qChapterId}
                  onChange={(e) => setQChapterId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                >
                  {filteredChaptersForSelectedSubject.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase mb-1">Topic / DPP Name</label>
                <input
                  type="text"
                  value={qTopicName}
                  onChange={(e) => setQTopicName(e.target.value)}
                  placeholder="e.g. Kinematics Level 2 DPP"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[9.5px] font-extrabold text-slate-700 uppercase mb-1">Total Qs</label>
                  <input
                    type="number"
                    min="1"
                    value={qCount}
                    onChange={(e) => setQCount(e.target.value)}
                    required
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-extrabold text-slate-700 uppercase mb-1">From Q#</label>
                  <input
                    type="number"
                    value={qStartFrom}
                    onChange={(e) => setQStartFrom(e.target.value)}
                    placeholder="1"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-center"
                  />
                </div>
                <div>
                  <label className="block text-[9.5px] font-extrabold text-slate-700 uppercase mb-1">To Q#</label>
                  <input
                    type="number"
                    value={qEndOn}
                    onChange={(e) => setQEndOn(e.target.value)}
                    placeholder="30"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-center"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-black text-xs hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuestion}
                  className="flex-1 py-2.5 rounded-xl bg-teal text-white font-black text-xs hover:bg-teal/90 disabled:opacity-50 shadow-md"
                >
                  {savingQuestion ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 11. AI DOUBT SOLVER SHEET */}
      <AiChatSheet open={doubtOpen} onClose={() => setDoubtOpen(false)} studentContext={studentContext} />

      {/* 12. BOTTOM NAVIGATION */}
      <BottomNav />
    </div>
  );
}
