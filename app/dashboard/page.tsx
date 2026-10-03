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

// Declare global Window interface for Native Flutter Push Notification Listener
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
}

interface ChapterItem {
  id: string;
  name: string;
  subject_id: string;
}

interface DailyLogItem {
  log_date: string;
  study_time_minutes: number;
  theory_minutes?: number;
  practice_minutes?: number;
  revision_minutes?: number;
}

interface ContentCardItem {
  id: string;
  quote: string;
  character: string;
  show: string;
  icon_or_sticker: string;
  color: string;
  bg: string;
  border: string;
  text: string;
  badge: string;
}

// ─── COLOR THEME PRESETS (AUTO-PICKED FOR DYNAMIC ENTRIES) ───────────────────
const COLOR_PRESETS = [
  { color: "from-sky-500 to-indigo-600", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-950", badge: "bg-sky-500" },
  { color: "from-amber-500 to-orange-600", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-950", badge: "bg-amber-500" },
  { color: "from-purple-600 to-indigo-600", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-950", badge: "bg-purple-600" },
  { color: "from-teal-500 to-emerald-600", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-950", badge: "bg-teal-500" },
  { color: "from-rose-500 to-pink-600", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-950", badge: "bg-rose-500" },
  { color: "from-blue-600 to-cyan-500", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-950", badge: "bg-blue-600" },
];

// ─── MOTIVATION QUOTES (HIGH-QUALITY LEGENDS) ────────────────────────────────
const FALLBACK_MOTIVATION_QUOTES: ContentCardItem[] = [
  {
    id: "m-1",
    quote: "Dream is not that which you see while sleeping, it is something that does not let you sleep.",
    character: "Dr. A.P.J. Abdul Kalam",
    show: "Wings of Fire",
    icon_or_sticker: "🚀",
    color: "from-sky-500 to-indigo-600",
    bg: "bg-sky-50",
    border: "border-sky-200",
    text: "text-sky-950",
    badge: "bg-sky-500",
  },
  {
    id: "m-2",
    quote: "Arise, awake, and stop not until the goal is reached. Strength is life, weakness is death.",
    character: "Swami Vivekananda",
    show: "Rousing Call to Youth",
    icon_or_sticker: "⚡",
    color: "from-amber-500 to-orange-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-950",
    badge: "bg-amber-500",
  },
  {
    id: "m-3",
    quote: "I do not believe in taking right decisions. I take decisions and then make them right.",
    character: "Ratan Tata",
    show: "Industrial Legend",
    icon_or_sticker: "🏛️",
    color: "from-slate-700 to-slate-900",
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-slate-950",
    badge: "bg-slate-700",
  },
  {
    id: "m-4",
    quote: "I have no special talents. I am only passionately curious. Solve the next problem.",
    character: "Albert Einstein",
    show: "Theoretical Physics",
    icon_or_sticker: "💡",
    color: "from-purple-600 to-indigo-600",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-950",
    badge: "bg-purple-600",
  },
  {
    id: "m-5",
    quote: "Nothing in life is to be feared, it is only to be understood. Now is the time to understand more.",
    character: "Marie Curie",
    show: "Double Nobel Laureate",
    icon_or_sticker: "🧪",
    color: "from-teal-600 to-cyan-600",
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-950",
    badge: "bg-teal-600",
  },
];

// ─── MEMES / ROASTS (GIF & URL READY) ────────────────────────────────────────
const FALLBACK_MEME_QUOTES: ContentCardItem[] = [
  {
    id: "meme-1",
    quote: "PAKAD PAKAD PAKAD... Isne aaj tak numericals solve nahi kiye! Daya, iska phone tod do! 😂",
    character: "ACP Pradyuman",
    show: "CID (Meme Edition)",
    icon_or_sticker: "👮",
    color: "from-gray-600 to-gray-800",
    bg: "bg-gray-50",
    border: "border-gray-300",
    text: "text-gray-950",
    badge: "bg-gray-600",
  },
  {
    id: "meme-2",
    quote: "Iske paas Doraemon hai, lekin rank laane ke liye khud padhna padega! Insta reels band karo!",
    character: "Nobita Nobi",
    show: "Doraemon",
    icon_or_sticker: "👓",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-950",
    badge: "bg-blue-500",
  },
  {
    id: "meme-3",
    quote: "Training? Homework? Test? Sab theek hai... par tune aaj kitne questions solve kiye? OK. 🤨",
    character: "Saitama",
    show: "One Punch Man",
    icon_or_sticker: "🥊",
    color: "from-yellow-500 to-amber-500",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-950",
    badge: "bg-yellow-500",
  },
  {
    id: "meme-placeholder-1",
    quote: "Pehle chapter me hi ghee khatam ho gaya? Abhi toh poori syllabus bachi hai bhai! Utho aur padho!",
    character: "Rajkummar Rao",
    show: "Stree (Meme)",
    icon_or_sticker: "/memes/rajkummar-rao-ghee.gif",
    color: "from-purple-500 to-indigo-500",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-950",
    badge: "bg-purple-500",
  },
  {
    id: "meme-placeholder-2",
    quote: "Formula yaad kiya tha mechanics ka, exam me thermo pooch liya! Revision karo jaldi!",
    character: "Study Panic",
    show: "Student Reality",
    icon_or_sticker: "📱",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-950",
    badge: "bg-emerald-500",
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

// ─── DUAL-MODE HERO WIDGET WITH ENLARGED MEDIA & SMART ROTATION ───────────────
function HeroWidget({
  name,
  streak,
  todayStudyMins,
}: {
  name: string;
  streak: number;
  todayStudyMins: number;
}) {
  const [hour, setHour] = useState(new Date().getHours());
  const [mode, setMode] = useState<"motivation" | "meme">("motivation");
  const [dbItems, setDbItems] = useState<Record<string, ContentCardItem[]>>({
    motivation: [],
    meme: [],
  });
  const [currentItem, setCurrentItem] = useState<ContentCardItem | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Fetch dynamic content from Supabase table `daily_content`
  useEffect(() => {
    async function fetchDynamicContent() {
      try {
        const { data, error } = await supabase
          .from("daily_content")
          .select("*")
          .eq("is_active", true);

        if (!error && data && data.length > 0) {
          const mList: ContentCardItem[] = [];
          const rList: ContentCardItem[] = [];

          data.forEach((row: any, idx: number) => {
            const fallbackPreset = COLOR_PRESETS[idx % COLOR_PRESETS.length];
            const item: ContentCardItem = {
              id: row.id,
              quote: row.quote,
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

          setDbItems({
            motivation: mList.length > 0 ? mList : FALLBACK_MOTIVATION_QUOTES,
            meme: rList.length > 0 ? rList : FALLBACK_MEME_QUOTES,
          });
        } else {
          setDbItems({
            motivation: FALLBACK_MOTIVATION_QUOTES,
            meme: FALLBACK_MEME_QUOTES,
          });
        }
      } catch {
        setDbItems({
          motivation: FALLBACK_MOTIVATION_QUOTES,
          meme: FALLBACK_MEME_QUOTES,
        });
      }
    }

    fetchDynamicContent();
  }, []);

  // SMART ANTI-REPETITION SELECTION ALGORITHM
  const pickNextItem = useCallback((currentMode: "motivation" | "meme") => {
    const deck =
      dbItems[currentMode].length > 0
        ? dbItems[currentMode]
        : currentMode === "motivation"
        ? FALLBACK_MOTIVATION_QUOTES
        : FALLBACK_MEME_QUOTES;

    const storageKey = `prepwise_seen_${currentMode}_ids`;
    let seenIds: string[] = [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) seenIds = JSON.parse(stored);
    } catch {}

    let unseen = deck.filter((item) => !seenIds.includes(item.id));

    if (unseen.length === 0) {
      seenIds = [];
      localStorage.removeItem(storageKey);
      unseen = deck;
    }

    const selected = unseen[Math.floor(Math.random() * unseen.length)] || deck[0];
    seenIds.push(selected.id);
    try {
      localStorage.setItem(storageKey, JSON.stringify(seenIds));
    } catch {}

    setImgError(false);
    setCurrentItem(selected);
  }, [dbItems]);

  useEffect(() => {
    pickNextItem(mode);
  }, [mode, pickNextItem]);

  const greeting = getGreeting(name, hour);
  const todayHours = (todayStudyMins / 60).toFixed(1);

  const greetingFontClass = greeting.length > 35 ? "text-xs" : "text-sm sm:text-base";
  const quoteLength = currentItem?.quote?.length ?? 0;
  const quoteFontClass =
    quoteLength > 130
      ? "text-[10.5px] leading-tight"
      : quoteLength > 80
      ? "text-[11.5px] leading-snug"
      : "text-xs leading-snug";

  const rawMediaSrc = currentItem?.icon_or_sticker || "";
  const isExternalImage =
    rawMediaSrc.startsWith("http://") ||
    rawMediaSrc.startsWith("https://") ||
    rawMediaSrc.startsWith("/");

  const safeMediaSrc = isExternalImage ? encodeURI(rawMediaSrc) : rawMediaSrc;

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-200/80 bg-white">
      {/* Top bar — gradient accent */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${currentItem?.color || "from-indigo-500 to-teal-500"}`} />

      <div className="p-4 pb-3">
        {/* Top Greeting & Streak Row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
              PrepWise Dashboard
            </p>
            <h2
              className={`${greetingFontClass} font-black text-slate-900 leading-snug break-normal [hyphens:none]`}
            >
              {greeting}
            </h2>
          </div>

          <div
            className={`flex-shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 ${
              streak > 0 ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-200"
            }`}
          >
            <span className="text-xl leading-none">{streak > 0 ? "🔥" : "💤"}</span>
            <span
              className={`text-sm font-black leading-tight ${
                streak > 0 ? "text-orange-600" : "text-slate-400"
              }`}
            >
              {streak}
            </span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
              {streak === 1 ? "Day" : "Days"}
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-base">⏱️</span>
            <div>
              <p className="text-[10px] font-bold text-teal-600 leading-none">Today</p>
              <p className="text-sm font-black text-teal-900 leading-tight">{todayHours}h studied</p>
            </div>
          </div>
          <div className="flex-1 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-base">🎯</span>
            <div>
              <p className="text-[10px] font-bold text-indigo-600 leading-none">Goal</p>
              <p className="text-sm font-black text-indigo-900 leading-tight">8h / day</p>
            </div>
          </div>
        </div>

        {/* ─── FULL-WIDTH DUAL-MODE SLIDER (LEFT TO RIGHT) ─── */}
        <div className="w-full p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-black flex items-center mb-2.5 shadow-inner">
          <button
            type="button"
            onClick={() => setMode("motivation")}
            className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
              mode === "motivation"
                ? "bg-white text-slate-900 shadow-sm font-black"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>🔥</span> Motivation
          </button>
          <button
            type="button"
            onClick={() => setMode("meme")}
            className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${
              mode === "meme"
                ? "bg-white text-slate-900 shadow-sm font-black"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>😂</span> Memes
          </button>
        </div>

        {/* ─── PROMINENT CARD WITH ENLARGED MEDIA BOX ─── */}
        {currentItem && (
          <button
            type="button"
            onClick={() => pickNextItem(mode)}
            className={`w-full text-left rounded-2xl border ${currentItem.border} ${currentItem.bg} p-2.5 sm:p-3 active:scale-[0.98] transition-all relative overflow-hidden group shadow-2xs`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-20 h-20 rounded-2xl flex-shrink-0 flex items-center justify-center ${currentItem.badge} shadow-xs overflow-hidden bg-black/5 relative`}
              >
                {isExternalImage && !imgError ? (
                  <img
                    src={safeMediaSrc}
                    alt={currentItem.character}
                    className="w-full h-full object-cover rounded-2xl"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span className="text-3xl">
                    {imgError ? "⭐" : currentItem.icon_or_sticker || "💡"}
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <p
                  className={`${quoteFontClass} font-bold ${currentItem.text} break-normal [hyphens:none]`}
                >
                  "{currentItem.quote}"
                </p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
                  <p className="text-[10px] font-black text-slate-600 truncate">
                    — {currentItem.character}
                    <span className="font-medium text-slate-400"> · {currentItem.show}</span>
                  </p>
                  <span className="text-[9.5px] font-bold text-slate-500 bg-white/90 border border-slate-200/90 px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1 shadow-2xs group-hover:bg-slate-100 transition-all">
                    Tap ↻
                  </span>
                </div>
              </div>
            </div>
          </button>
        )}

        {/* Streak Message */}
        {streak > 0 ? (
          <p className="text-[10px] font-bold text-orange-600 text-center mt-2">
            {streak >= 7
              ? `🔥 ${streak}-day streak — you're unstoppable! Keep it going!`
              : streak >= 3
              ? `🔥 ${streak}-day streak! Building momentum!`
              : `🔥 ${streak}-day streak started! Don't break the chain!`}
          </p>
        ) : (
          <p className="text-[10px] font-bold text-slate-400 text-center mt-2">
            Start a focus session today to build your streak! 💪
          </p>
        )}
      </div>
    </div>
  );
}

// ─── MULTI-DAY STUDY SPLIT TIMELINE ─────
function StudySplitTimelineWidget({ logs }: { logs: DailyLogItem[] }) {
  const [rangeMode, setRangeMode] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [selectedDay, setSelectedDay] = useState<any | null>(null);

  const chartData = useMemo(() => {
    const today = new Date();
    let numDays = 7;
    let startDate = new Date();

    if (rangeMode === "weekly") {
      numDays = 7;
      startDate.setDate(today.getDate() - 6);
    } else if (rangeMode === "monthly") {
      numDays = 30;
      startDate.setDate(today.getDate() - 29);
    } else {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      const diff = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      numDays = Math.min(diff, 60);
      startDate = s;
    }

    const logMap = new Map<string, DailyLogItem>();
    logs.forEach((l) => logMap.set(l.log_date, l));

    const result = [];
    for (let i = 0; i < numDays; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      const dateKey = current.toISOString().split("T")[0];
      const found = logMap.get(dateKey);

      const totalMins = found?.study_time_minutes || 0;
      const theory = found?.theory_minutes || 0;
      const practice = found?.practice_minutes || 0;
      const revision = found?.revision_minutes || 0;

      result.push({
        dateKey,
        label: current.toLocaleDateString("en-IN", {
          day: "numeric",
          month: numDays > 14 ? "numeric" : "short",
          weekday: numDays <= 7 ? "narrow" : undefined,
        }),
        fullDate: current.toLocaleDateString("en-IN", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        totalMins,
        totalHours: totalMins / 60,
        theoryHours: theory / 60,
        practiceHours: practice / 60,
        revisionHours: revision / 60,
      });
    }
    return result;
  }, [logs, rangeMode, customStart, customEnd]);

  const totalMinsInRange = chartData.reduce((acc, d) => acc + d.totalMins, 0);
  const avgMinsInRange = chartData.length > 0 ? totalMinsInRange / chartData.length : 0;
  const maxHours = Math.max(8, ...chartData.map((d) => d.totalHours));

  const activeDetail = selectedDay || chartData[chartData.length - 1];

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <span>📊</span> Study Split History
          </h3>
          <p className="text-[10px] font-semibold text-slate-500">
            Daily duration & subject activity breakdown
          </p>
        </div>

        <div className="flex p-0.5 bg-slate-100 rounded-xl border border-slate-200 text-[10px] font-black self-start sm:self-auto">
          {(["weekly", "monthly", "custom"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setRangeMode(m)}
              className={`px-2.5 py-1 rounded-lg transition-all capitalize ${
                rangeMode === m
                  ? "bg-white text-slate-900 shadow-2xs font-black"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {rangeMode === "custom" && (
        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-bold">
          <div className="flex-1">
            <span className="text-slate-500 block mb-0.5">From</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full bg-white p-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
            />
          </div>
          <div className="flex-1">
            <span className="text-slate-500 block mb-0.5">To</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full bg-white p-1 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
          <span className="text-[9px] font-bold text-slate-500 uppercase block">Total Focused</span>
          <span className="text-sm font-black text-slate-900">
            {(totalMinsInRange / 60).toFixed(1)}h
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2">
          <span className="text-[9px] font-bold text-slate-500 uppercase block">Daily Average</span>
          <span className="text-sm font-black text-teal-700">
            {(avgMinsInRange / 60).toFixed(1)}h / day
          </span>
        </div>
      </div>

      <div className="pt-2">
        <div className="h-36 flex items-end gap-1.5 sm:gap-2 px-1 border-b border-slate-200 pb-1.5 overflow-x-auto no-scrollbar">
          {chartData.map((d, idx) => {
            const isSelected = activeDetail?.dateKey === d.dateKey;
            const totalPct = Math.min(100, Math.round((d.totalHours / maxHours) * 100));

            const totalHoursClean = d.totalHours > 0 ? d.totalHours : 1;
            const theoryFrac = d.theoryHours / totalHoursClean;
            const practiceFrac = d.practiceHours / totalHoursClean;
            const revisionFrac = d.revisionHours / totalHoursClean;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(d)}
                className="flex-1 min-w-[20px] max-w-[48px] h-full flex flex-col justify-end items-center cursor-pointer group transition-all"
              >
                {d.totalMins > 0 ? (
                  <div
                    style={{ height: `${Math.max(totalPct, 8)}%` }}
                    className={`w-full rounded-t-md overflow-hidden flex flex-col-reverse shadow-xs transition-transform ${
                      isSelected ? "ring-2 ring-slate-900 scale-105" : "hover:opacity-90"
                    }`}
                  >
                    <div
                      style={{ height: `${Math.round(theoryFrac * 100)}%` }}
                      className="w-full bg-amber-500"
                      title={`Theory: ${d.theoryHours.toFixed(1)}h`}
                    />
                    <div
                      style={{ height: `${Math.round(practiceFrac * 100)}%` }}
                      className="w-full bg-teal-600"
                      title={`Practice: ${d.practiceHours.toFixed(1)}h`}
                    />
                    <div
                      style={{ height: `${Math.round(revisionFrac * 100)}%` }}
                      className="w-full bg-indigo-600"
                      title={`Revision: ${d.revisionHours.toFixed(1)}h`}
                    />
                  </div>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mb-1" />
                )}

                <span
                  className={`text-[9px] mt-1 font-bold truncate ${
                    isSelected ? "text-slate-900 font-black" : "text-slate-400"
                  }`}
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {activeDetail && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block">
              {activeDetail.fullDate}
            </span>
            <span className="text-sm font-black text-slate-900">
              {activeDetail.totalHours.toFixed(1)}h Total
            </span>
          </div>

          <div className="flex items-center gap-2.5 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {activeDetail.theoryHours.toFixed(1)}h Theory
            </span>
            <span className="flex items-center gap-1 text-teal-800">
              <span className="w-2 h-2 rounded-full bg-teal-600" />
              {activeDetail.practiceHours.toFixed(1)}h Practice
            </span>
            <span className="flex items-center gap-1 text-indigo-800">
              <span className="w-2 h-2 rounded-full bg-indigo-600" />
              {activeDetail.revisionHours.toFixed(1)}h Rev
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-500 pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Theory
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-teal-600" /> Practice
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" /> Revision
        </span>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  // Point 12: Combined Total Study Minutes (Timer sessions + Manual offline study)
  const [todayStudyMins, setTodayStudyMins] = useState(0);
  const [todayQuestions, setTodayQuestions] = useState(0);
  const [totalQuestionsAllTime, setTotalQuestionsAllTime] = useState(0);
  const [streak, setStreak] = useState(0);

  const [allPastLogs, setAllPastLogs] = useState<DailyLogItem[]>([]);

  const [backlogsList, setBacklogsList] = useState<TaskItem[]>([]);
  const [showAddBacklogModal, setShowAddBacklogModal] = useState(false);
  const [backlogMode, setBacklogMode] = useState<"chapter" | "other">("chapter");

  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [backlogTitle, setBacklogTitle] = useState("");
  const [backlogPriority, setBacklogPriority] = useState<"high" | "medium" | "low">("high");
  const [backlogDueDate, setBacklogDueDate] = useState<string>("");

  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>([]);
  const [filteredSubjects, setFilteredSubjects] = useState<SubjectItem[]>([]);
  const [chaptersList, setChaptersList] = useState<ChapterItem[]>([]);
  const [submittingBacklog, setSubmittingBacklog] = useState(false);

  const [splitRatio, setSplitRatio] = useState({
    theory: 0,
    practice: 0,
    revision: 0,
  });

  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([]);
  const [recentTests, setRecentTests] = useState<TestLog[]>([]);
  const [heatGrid, setHeatGrid] = useState<number[]>([]);

  const [examSchedules, setExamSchedules] = useState<ExamScheduleItem[]>([]);
  const [shiftsMap, setShiftsMap] = useState<Record<string, ExamShift[]>>({});
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // 🔔 Automatic FCM Push Notification Token Sync to Supabase
  useEffect(() => {
    async function syncNativeToken(token: string) {
      if (!token) return;
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        await supabase
          .from("users")
          .update({ fcm_token: token, updated_at: new Date().toISOString() })
          .eq("uid", authData.user.id);
      }
    }

    const cachedToken = localStorage.getItem("prepwise_native_fcm_token");
    if (cachedToken) {
      syncNativeToken(cachedToken);
    }

    window.onNativeFCMToken = (token: string) => {
      localStorage.setItem("prepwise_native_fcm_token", token);
      syncNativeToken(token);
    };

    // Live listener for direct background study session logging from native bridge
    window.onNativeFocusSessionLogged = (addedMins: number) => {
      if (typeof addedMins === "number" && addedMins > 0) {
        setTodayStudyMins((prev) => prev + addedMins);
      }
    };
    window.onDirectLoggedSession = (data: any) => {
      if (data?.seconds) {
        const addedMins = Math.max(1, Math.round(data.seconds / 60));
        setTodayStudyMins((prev) => prev + addedMins);
      }
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      // Point 8: Check session safely to eliminate 1-2s login page flicker on restart
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const hasLocalToken =
          typeof window !== "undefined" &&
          Object.keys(localStorage).some(
            (k) => k.startsWith("sb-") && k.endsWith("-auth-token")
          );
        if (!hasLocalToken) {
          router.push("/");
          return;
        }
      }

      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);

      const { data: uProf } = await supabase
        .from("users")
        .select("*")
        .eq("uid", session.user.id)
        .maybeSingle();

      if (uProf) {
        setProfile(uProf);
        setSelectedShiftId(uProf.selected_shift_id || null);

        const cached = localStorage.getItem(`mentor_report_${session.user.id}`);
        if (cached) {
          try {
            setMentorReport(JSON.parse(cached));
          } catch {
            fetchMentorReport(session.user.id, false);
          }
        } else {
          fetchMentorReport(session.user.id, false);
        }

        const allowedClasses = classLevelsForContent(uProf.class_level);
        setSelectedClass(allowedClasses[0] || "11");

        const { data: subs } = await supabase
          .from("subjects")
          .select("id, name, class_level")
          .in("class_level", allowedClasses.length ? allowedClasses : ["11", "12"]);

        if (subs) {
          setAllSubjects(subs);
          const initialFiltered = subs.filter((s) => s.class_level === (allowedClasses[0] || "11"));
          setFilteredSubjects(initialFiltered);
          if (initialFiltered[0]) {
            setSelectedSubjectId(initialFiltered[0].id);
            fetchChaptersForSubject(initialFiltered[0].id);
          }
        }
      }

      const targetExam = uProf?.target_exam || "JEE";
      const targetYear = Number(uProf?.target_year) || 2027;
      const isDropper = uProf?.class_level === "Dropper";
      const wantsBoards = !isDropper && Boolean(uProf?.wants_boards);

      const { data: schedules } = await supabase
        .from("exam_schedule")
        .select("*")
        .eq("year", targetYear)
        .order("display_order", { ascending: true });

      let studentSchedules: ExamScheduleItem[] = [];

      if (schedules && schedules.length > 0) {
        studentSchedules = schedules.filter((s) => {
          if (s.target_exam === "Boards") {
            return wantsBoards;
          }
          return s.target_exam === targetExam || s.target_exam === "ALL";
        });

        const scheduleIds = studentSchedules.map((s) => s.id);
        const { data: shifts } = await supabase
          .from("exam_shifts")
          .select("*")
          .in("exam_schedule_id", scheduleIds)
          .order("display_order", { ascending: true });

        if (shifts) {
          const sMap: Record<string, ExamShift[]> = {};
          shifts.forEach((sh) => {
            if (!sMap[sh.exam_schedule_id]) sMap[sh.exam_schedule_id] = [];
            sMap[sh.exam_schedule_id].push(sh);
          });
          setShiftsMap(sMap);
        }
      }

      if (studentSchedules.length === 0) {
        if (targetExam === "JEE") {
          studentSchedules.push({
            id: "mains-fallback",
            exam_key: "jee_mains",
            label: "JEE Main",
            target_exam: "JEE",
            year: targetYear,
            exam_date: `${targetYear}-01-22T09:00:00`,
            is_confirmed: false,
          });
          studentSchedules.push({
            id: "adv-fallback",
            exam_key: "jee_advanced",
            label: "JEE Advanced",
            target_exam: "JEE",
            year: targetYear,
            exam_date: `${targetYear}-05-24T09:00:00`,
            is_confirmed: false,
          });
        } else if (targetExam === "NEET") {
          studentSchedules.push({
            id: "neet-fallback",
            exam_key: "neet_ug",
            label: "NEET UG",
            target_exam: "NEET",
            year: targetYear,
            exam_date: `${targetYear}-05-03T14:00:00`,
            is_confirmed: false,
          });
        }
        if (wantsBoards) {
          studentSchedules.push({
            id: "boards-fallback",
            exam_key: "board_exam",
            label: `${uProf?.class_level || "12th"} Board`,
            target_exam: "Boards",
            year: targetYear,
            exam_date: `${targetYear}-02-15T10:30:00`,
            is_confirmed: false,
          });
        }
      }

      setExamSchedules(studentSchedules);

      const todayStr = new Date().toISOString().split("T")[0];

      // 1. Fetch daily logs for the 84-day consistency matrix & breakdown
      const { data: pastLogs } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, streak_count, log_date")
        .eq("user_id", session.user.id)
        .order("log_date", { ascending: false })
        .limit(84);

      if (pastLogs) {
        setAllPastLogs(pastLogs);
      }

      const todayLog = pastLogs?.find((l) => l.log_date === todayStr);
      const dailyLogMins = todayLog?.study_time_minutes || 0;

      // 2. Fetch today's focus sessions to guarantee any background/killed app sessions are counted
      const todayStartIso = `${todayStr}T00:00:00.000Z`;
      let sessionMins = 0;
      try {
        const { data: todaySessions } = await supabase
          .from("focus_sessions")
          .select("duration_seconds")
          .eq("user_id", session.user.id)
          .gte("started_at", todayStartIso);

        if (todaySessions && todaySessions.length > 0) {
          const totalSecs = todaySessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
          sessionMins = Math.round(totalSecs / 60);
        }
      } catch (err) {
        console.error("Focus sessions query error:", err);
      }

      // Combine timer sessions + manual entries (ensuring no drop if daily_logs was delayed)
      const combinedTotalTodayStudyMins = Math.max(dailyLogMins, sessionMins);
      setTodayStudyMins(combinedTotalTodayStudyMins);

      // Point 2: Unified streak reconciliation engine (Synchronized with Focus page)
      try {
        const streakInfo = await loadAndReconcileStreak(session.user.id);
        setStreak(streakInfo.currentStreak);
      } catch (e) {
        setStreak(todayLog?.streak_count || pastLogs?.[0]?.streak_count || 0);
      }

      setSplitRatio({
        theory: todayLog?.theory_minutes || 0,
        practice: todayLog?.practice_minutes || 0,
        revision: todayLog?.revision_minutes || 0,
      });

      const { data: qLogs } = await supabase
        .from("question_logs")
        .select("question_count, log_date")
        .eq("user_id", session.user.id);

      const todayQ =
        qLogs
          ?.filter((q) => q.log_date === todayStr)
          .reduce((acc, q) => acc + (q.question_count || 0), 0) || 0;
      setTodayQuestions(todayQ);

      const totalQ = (qLogs || []).reduce((acc, q) => acc + (q.question_count || 0), 0);
      setTotalQuestionsAllTime(totalQ);

      const grid = new Array(84).fill(0);
      if (pastLogs) {
        pastLogs.forEach((l) => {
          const d = new Date(l.log_date);
          const daysAgo = Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
          if (daysAgo >= 0 && daysAgo < 84) {
            const hrs = (l.study_time_minutes || 0) / 60;
            let level = 0;
            if (hrs >= 6) level = 4;
            else if (hrs >= 4) level = 3;
            else if (hrs >= 2) level = 2;
            else if (hrs > 0) level = 1;
            grid[83 - daysAgo] = level;
          }
        });
      }
      setHeatGrid(grid);

      const { data: userTasks } = await supabase
        .from("tasks")
        .select("id, title, priority, status, task_type, due_date")
        .eq("user_id", session.user.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (userTasks) {
        const bl = userTasks.filter((t) => t.task_type === "backlog");
        const regularTasks = userTasks.filter((t) => t.task_type !== "backlog");
        setBacklogsList(bl);
        setTodayTasks(regularTasks.slice(0, 4));
      }

      const { data: testData } = await supabase
        .from("test_logs")
        .select("id, test_name, total_marks, max_marks, accuracy, test_date")
        .eq("user_id", session.user.id)
        .order("test_date", { ascending: false })
        .limit(3);

      if (testData) setRecentTests(testData);

      setLoading(false);
    }

    loadData();
  }, [router]);

  const fetchChaptersForSubject = async (subjId: string) => {
    if (!subjId) return;
    const { data } = await supabase
      .from("chapters")
      .select("id, name, subject_id")
      .eq("subject_id", subjId)
      .order("display_order", { ascending: true });

    if (data && data.length > 0) {
      setChaptersList(data);
      setSelectedChapterId(data[0].id);
    } else {
      setChaptersList([]);
      setSelectedChapterId("");
    }
  };

  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    const filtered = allSubjects.filter((s) => s.class_level === newClass);
    setFilteredSubjects(filtered);
    if (filtered[0]) {
      setSelectedSubjectId(filtered[0].id);
      fetchChaptersForSubject(filtered[0].id);
    } else {
      setSelectedSubjectId("");
      setChaptersList([]);
      setSelectedChapterId("");
    }
  };

  const handleSubjectChange = (subjId: string) => {
    setSelectedSubjectId(subjId);
    fetchChaptersForSubject(subjId);
  };

  const fetchMentorReport = async (uid: string, force = false) => {
    setMentorLoading(true);
    try {
      const res = await fetch("/api/ai-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, forceRefresh: force }),
      });
      if (res.ok) {
        const json = await res.json();
        setMentorReport(json.report);
        if (json.report) {
          localStorage.setItem(`mentor_report_${uid}`, JSON.stringify(json.report));
        }
      }
    } catch (e) {
      console.error("Mentor fetch error:", e);
    } finally {
      setMentorLoading(false);
    }
  };

  const handleShiftSelect = async (shiftId: string) => {
    setSelectedShiftId(shiftId);
    if (user?.id) {
      await supabase.from("users").update({ selected_shift_id: shiftId }).eq("uid", user.id);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    setTodayTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
  };

  const handleCompleteBacklog = async (id: string) => {
    setBacklogsList((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
  };

  const handleSaveBacklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || submittingBacklog) return;

    let finalTitle = "";
    if (backlogMode === "chapter") {
      const foundChap = chaptersList.find((c) => c.id === selectedChapterId);
      const foundSub = filteredSubjects.find((s) => s.id === selectedSubjectId);
      const prefix = foundChap ? foundChap.name : foundSub ? foundSub.name : "Syllabus Topic";
      finalTitle = backlogTitle.trim() ? `${prefix}: ${backlogTitle.trim()}` : prefix;

      if (selectedChapterId) {
        await supabase.from("chapter_progress").upsert({
          user_id: user.id,
          chapter_id: selectedChapterId,
          is_backlog: true,
          updated_at: new Date().toISOString(),
        });
      }
    } else {
      if (!backlogTitle.trim()) return;
      finalTitle = backlogTitle.trim();
    }

    setSubmittingBacklog(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: finalTitle,
          task_type: "backlog",
          priority: backlogPriority,
          status: "pending",
          due_date: backlogDueDate || null,
        })
        .select()
        .single();

      if (!error && data) {
        setBacklogsList((prev) => [data, ...prev]);
        setBacklogTitle("");
        setBacklogDueDate("");
        setShowAddBacklogModal(false);
      }
    } catch (err) {
      console.error("Backlog submit error:", err);
    } finally {
      setSubmittingBacklog(false);
    }
  };

  const calculateDaysLeft = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center text-white p-6">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-2xl shadow-lg shadow-teal-500/10 mb-4 animate-pulse">
          ⚡
        </div>
        <h2 className="text-base font-black tracking-wide">PrepWise Cockpit</h2>
        <p className="text-xs text-slate-400 mt-1">Syncing study streak & analytics…</p>
      </div>
    );
  }

  const targetExam = profile?.target_exam || "JEE";
  const allowedClasses = classLevelsForContent(profile?.class_level);
  const todayHours = (todayStudyMins / 60).toFixed(1);

  const sumSplit = splitRatio.theory + splitRatio.practice + splitRatio.revision;
  const totalSplitMins = sumSplit > 0 ? sumSplit : 1;
  const theoryPct = Math.round((splitRatio.theory / totalSplitMins) * 100);
  const practicePct = Math.round((splitRatio.practice / totalSplitMins) * 100);
  const revisionPct = Math.round((splitRatio.revision / totalSplitMins) * 100);

  const studentName =
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    "Champion";
  const firstName = studentName.split(" ")[0];

  return (
    <div className="min-h-screen bg-[#F1F5F9] pb-28 text-[#0F172A] font-sans antialiased">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-3.5 space-y-3">
        {/* 0. DUAL-MODE HERO WIDGET WITH ENLARGED MEDIA CONTAINER */}
        <HeroWidget
          name={firstName}
          streak={streak}
          todayStudyMins={todayStudyMins}
        />

        {/* 1. COMPACT DUAL/SINGLE COUNTDOWN CAROUSEL */}
        <div
          className={`grid gap-2 ${
            examSchedules.length > 1 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {examSchedules.map((exam) => {
            const days = calculateDaysLeft(exam.exam_date);
            const shifts = shiftsMap[exam.id] || [];

            return (
              <div
                key={exam.id}
                className="rounded-2xl p-3 bg-[#0B132B] text-white shadow-md border border-slate-800 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="text-[9.5px] font-black uppercase tracking-wider text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30 truncate">
                    {exam.label}
                  </span>
                  <span className="text-[8.5px] font-semibold text-slate-400 flex-shrink-0">
                    {exam.is_confirmed ? "Official" : "Proj."}
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-1 mb-1">
                  <div className="text-2xl font-black tracking-tight text-amber-400 leading-none">
                    {days}
                    <span className="text-[9.5px] font-bold text-slate-300 uppercase ml-1">
                      Days
                    </span>
                  </div>
                  <div className="text-[10px] font-medium text-slate-300">
                    {new Date(exam.exam_date).toLocaleDateString("en-IN", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>

                {shifts.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/10">
                    <select
                      value={selectedShiftId || ""}
                      onChange={(e) => handleShiftSelect(e.target.value)}
                      className="w-full bg-slate-800/90 text-white rounded-lg px-2 py-1 border border-slate-700 text-[9.5px] font-medium focus:outline-none focus:border-amber-400 truncate"
                    >
                      <option value="">Select Shift</option>
                      {shifts.map((sh) => (
                        <option key={sh.id} value={sh.id}>
                          {sh.shift_date} ({sh.shift_time})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 2. AI MENTOR WIDGET */}
        <AiMentorCard
          userId={user?.id}
          targetExam={targetExam}
          report={mentorReport}
          loading={mentorLoading}
          onRefresh={() => fetchMentorReport(user?.id, true)}
          onOpenDoubtSolver={() => setDoubtOpen(true)}
        />

        {/* 3. THREE COCKPIT METRICS (Total Study Time: Timer + Offline/Manual Study) */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => router.push("/focus")}
            className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] text-left active:scale-[0.98] transition-all hover:border-teal-500"
          >
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Today Study</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">
              {todayHours}
              <span className="text-xs font-semibold text-slate-500 ml-0.5">h</span>
              <span className="text-[10px] font-bold text-slate-400 ml-1">({todayStudyMins}m)</span>
            </div>
            <span className="text-[10px] font-bold text-teal-700 block mt-0.5">Study Timer →</span>
          </button>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Questions</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">{todayQuestions}</div>
            <span className="text-[10px] font-bold text-indigo-700 block mt-0.5">
              All: {totalQuestionsAllTime}
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Backlogs</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">{backlogsList.length}</div>
            <span
              className={`text-[10px] font-bold block mt-0.5 ${
                backlogsList.length > 0 ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {backlogsList.length > 0 ? "Pending" : "Clean ✓"}
            </span>
          </div>
        </div>

        {/* 4. BACKLOG RADAR WIDGET */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <div className="flex items-center gap-2 text-slate-900">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse" />
              <span className="text-sm font-black">Backlog Radar</span>
              <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                {backlogsList.length} Pending
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddBacklogModal(true)}
              className="text-[11px] font-black text-teal-800 bg-teal-100/80 hover:bg-teal-200 border border-teal-300 px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-2xs"
            >
              + Add Backlog
            </button>
          </div>

          {backlogsList.length === 0 ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-900 font-bold">
              🎉 Zero backlogs! All homework, DPPs & syllabus chapters are on schedule.
            </div>
          ) : (
            <div className="space-y-2">
              {backlogsList.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        b.priority === "high" ? "bg-rose-600" : b.priority === "medium" ? "bg-amber-500" : "bg-emerald-600"
                      }`}
                    />
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">{b.title}</span>
                      {b.due_date && <span className="text-[10px] font-semibold text-slate-500 block">Target: {b.due_date}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCompleteBacklog(b.id)}
                    className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-200 active:scale-95 flex-shrink-0"
                  >
                    Done ✓
                  </button>
                </div>
              ))}
              {backlogsList.length > 5 && (
                <button
                  type="button"
                  onClick={() => router.push("/library")}
                  className="w-full text-center text-[11px] font-bold text-slate-600 hover:text-slate-900 pt-1.5 block"
                >
                  View all {backlogsList.length} backlogs in Syllabus Tracker →
                </button>
              )}
            </div>
          )}
        </div>

        {/* 5. TODAY'S STUDY DISTRIBUTION RATIO */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>⚖️</span> Today's Study Split
            </span>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
              Target: 60% Practice
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex mb-2.5 shadow-inner">
            <div
              style={{ width: `${sumSplit > 0 ? theoryPct : 33}%` }}
              className="bg-amber-500 transition-all"
            />
            <div
              style={{ width: `${sumSplit > 0 ? practicePct : 50}%` }}
              className="bg-teal-600 transition-all"
            />
            <div
              style={{ width: `${sumSplit > 0 ? revisionPct : 17}%` }}
              className="bg-indigo-600 transition-all"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold px-0.5">
            <span className="flex items-center gap-1.5 text-amber-800">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Theory ({splitRatio.theory}m)
            </span>
            <span className="flex items-center gap-1.5 text-teal-800">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" /> Practice ({splitRatio.practice}m)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-800">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Revision ({splitRatio.revision}m)
            </span>
          </div>
        </div>

        {/* 6. MULTI-DAY STUDY SPLIT TIMELINE */}
        <StudySplitTimelineWidget logs={allPastLogs} />

        {/* 7. 12-WEEK CONSISTENCY MATRIX */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-3">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>🟩</span> 12-Week Consistency Matrix
            </span>
            <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
              🔥 {streak} Day Streak
            </span>
          </div>

          <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
            {Array.from({ length: 12 }).map((_, weekIdx) => (
              <div key={weekIdx} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cellIdx = weekIdx * 7 + dayIdx;
                  const level = heatGrid[cellIdx] ?? 0;
                  const colors = [
                    "bg-slate-100",
                    "bg-teal-200",
                    "bg-teal-400",
                    "bg-teal-600",
                    "bg-teal-800",
                  ];
                  return (
                    <div
                      key={dayIdx}
                      className={`w-full aspect-square rounded-[2px] ${colors[level]}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 justify-end">
            <span className="text-[10px] font-semibold text-slate-400">Less</span>
            {["bg-slate-100", "bg-teal-200", "bg-teal-400", "bg-teal-600", "bg-teal-800"].map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span className="text-[10px] font-semibold text-slate-400">More</span>
          </div>
        </div>

        {/* 8. PRIORITY ACTION ITEMS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>🎯</span> Today's Priority Goals
            </span>
            <button
              type="button"
              onClick={() => router.push("/todo")}
              className="text-[11px] font-bold text-teal-800 hover:underline"
            >
              Open To-Do List →
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs text-emerald-900 font-bold">
              🎉 No pending tasks! Plan goals in your To-Do tab.
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        task.priority === "high" ? "bg-rose-600" : task.priority === "medium" ? "bg-amber-500" : "bg-emerald-600"
                      }`}
                    />
                    <span className="font-bold text-slate-900 truncate">{task.title}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id)}
                    className="text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-lg hover:bg-emerald-200 active:scale-95 flex-shrink-0"
                  >
                    Done ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 9. QUICK ROUTE CARDS */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">📚</div>
            <div className="text-xs font-black text-slate-900">Syllabus Tracker</div>
            <div className="text-[10px] font-semibold text-slate-500">Chapters & Backlogs</div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">📊</div>
            <div className="text-xs font-black text-slate-900">Test Hub</div>
            <div className="text-[10px] font-semibold text-slate-500">Log & analyze marks</div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/error-book")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">📕</div>
            <div className="text-xs font-black text-slate-900">Error Book</div>
            <div className="text-[10px] font-semibold text-slate-500">Mistakes & Voice Notes</div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/groups")}
            className="p-3.5 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all"
          >
            <div className="text-xl mb-1">👥</div>
            <div className="text-xs font-black text-slate-900">Study Groups</div>
            <div className="text-[10px] font-semibold text-slate-500">PrepWise World Feed</div>
          </button>
        </div>

        {/* 10. RECENT MOCK TESTS */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>📈</span> Recent Mock Performance
            </span>
            <button
              type="button"
              onClick={() => router.push("/tests")}
              className="text-[11px] font-bold text-indigo-700 hover:underline"
            >
              View Hub →
            </button>
          </div>

          {recentTests.length === 0 ? (
            <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs font-black text-indigo-950">No Tests Logged</div>
                <div className="text-[10px] font-semibold text-slate-600">Log mock test marks to track accuracy</div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/tests")}
                className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                + Log Score
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {recentTests.map((t) => (
                <div
                  key={t.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-black text-slate-900 text-xs">{t.test_name}</div>
                    <div className="text-[10px] font-semibold text-slate-500">{t.test_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-sm">
                      {t.total_marks} / {t.max_marks}
                    </div>
                    <div className="text-[10px] font-bold text-teal-700">
                      Acc: {t.accuracy || Math.round((t.total_marks / t.max_marks) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 11. BACKLOG MODAL */}
      {showAddBacklogModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center text-sm shadow-xs font-bold">
                  🎯
                </span>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Add Academic Backlog</h3>
                  <p className="text-[10px] font-semibold text-slate-500">Track and eliminate pending syllabus</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBacklogModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3 border-b border-slate-200 bg-slate-100">
              <div className="grid grid-cols-2 p-1 bg-slate-200 rounded-xl text-xs font-black">
                <button
                  type="button"
                  onClick={() => setBacklogMode("chapter")}
                  className={`py-2 rounded-lg transition-all ${
                    backlogMode === "chapter"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  📚 Chapter Backlog
                </button>
                <button
                  type="button"
                  onClick={() => setBacklogMode("other")}
                  className={`py-2 rounded-lg transition-all ${
                    backlogMode === "other"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🎯 Other (DPP/Test)
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveBacklog} className="p-4 space-y-3.5 overflow-y-auto text-xs">
              {backlogMode === "chapter" ? (
                <>
                  {allowedClasses.length > 1 && (
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                        Select Class
                      </label>
                      <div className="flex gap-2">
                        {allowedClasses.map((cl) => (
                          <button
                            key={cl}
                            type="button"
                            onClick={() => handleClassChange(cl)}
                            className={`flex-1 py-2 rounded-xl border text-xs font-black transition-all ${
                              selectedClass === cl
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            Class {cl}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Subject
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600"
                    >
                      {filteredSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} (Class {sub.class_level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Syllabus Chapter
                    </label>
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-600"
                    >
                      {chaptersList.map((chap) => (
                        <option key={chap.id} value={chap.id}>
                          {chap.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                      Specific Sub-topic / Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={backlogTitle}
                      onChange={(e) => setBacklogTitle(e.target.value)}
                      placeholder="e.g. Only Moment of Inertia & Rolling Motion pending"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-teal-600"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                    Backlog Description / Task Name
                  </label>
                  <input
                    type="text"
                    value={backlogTitle}
                    onChange={(e) => setBacklogTitle(e.target.value)}
                    placeholder="e.g. Allen Mock Test #3 Negative Marking Analysis"
                    required
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:border-teal-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Priority Urgency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBacklogPriority("high")}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                      backlogPriority === "high"
                        ? "bg-rose-100 border-rose-400 text-rose-800 shadow-xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <span>🔴</span> High
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacklogPriority("medium")}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                      backlogPriority === "medium"
                        ? "bg-amber-100 border-amber-400 text-amber-800 shadow-xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <span>🟡</span> Medium
                  </button>
                  <button
                    type="button"
                    onClick={() => setBacklogPriority("low")}
                    className={`py-2 px-2 rounded-xl text-xs font-black border transition-all flex items-center justify-center gap-1 ${
                      backlogPriority === "low"
                        ? "bg-emerald-100 border-emerald-400 text-emerald-800 shadow-xs"
                        : "bg-white border-slate-300 text-slate-700"
                    }`}
                  >
                    <span>🟢</span> Low
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-slate-700 uppercase tracking-wider mb-1">
                  Target Elimination Date
                </label>
                <input
                  type="date"
                  value={backlogDueDate}
                  onChange={(e) => setBacklogDueDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBacklogModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-black text-xs hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBacklog || (backlogMode === "other" && !backlogTitle.trim())}
                  className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-slate-800 disabled:opacity-40 transition-all shadow-md"
                >
                  {submittingBacklog ? "Saving…" : "Save Backlog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Doubt Solver Sheet */}
      <AiChatSheet open={doubtOpen} onClose={() => setDoubtOpen(false)} />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
