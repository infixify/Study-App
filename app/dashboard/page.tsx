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

const COLOR_PRESETS = [
  { color: "from-sky-500 to-indigo-600", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-950", badge: "bg-sky-500" },
  { color: "from-amber-500 to-orange-600", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-950", badge: "bg-amber-500" },
  { color: "from-purple-600 to-indigo-600", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-950", badge: "bg-purple-600" },
  { color: "from-teal-500 to-emerald-600", bg: "bg-teal-50", border: "border-teal-200", text: "text-teal-950", badge: "bg-teal-500" },
];

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
];

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

function HeroWidget({ name, streak, todayStudyMins }: { name: string; streak: number; todayStudyMins: number }) {
  const [hour, setHour] = useState(new Date().getHours());
  const [mode, setMode] = useState<"motivation" | "meme">("motivation");
  const [dbItems, setDbItems] = useState<Record<string, ContentCardItem[]>>({ motivation: [], meme: [] });
  const [currentItem, setCurrentItem] = useState<ContentCardItem | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setHour(new Date().getHours()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchDynamicContent() {
      try {
        const { data, error } = await supabase.from("daily_content").select("*").eq("is_active", true);
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
          setDbItems({ motivation: FALLBACK_MOTIVATION_QUOTES, meme: FALLBACK_MEME_QUOTES });
        }
      } catch {
        setDbItems({ motivation: FALLBACK_MOTIVATION_QUOTES, meme: FALLBACK_MEME_QUOTES });
      }
    }
    fetchDynamicContent();
  }, []);

  const pickNextItem = useCallback((currentMode: "motivation" | "meme") => {
    const deck = dbItems[currentMode].length > 0 ? dbItems[currentMode] : currentMode === "motivation" ? FALLBACK_MOTIVATION_QUOTES : FALLBACK_MEME_QUOTES;
    const selected = deck[Math.floor(Math.random() * deck.length)] || deck[0];
    setCurrentItem(selected);
  }, [dbItems]);

  useEffect(() => {
    pickNextItem(mode);
  }, [mode, pickNextItem]);

  const greeting = getGreeting(name, hour);
  const todayHours = (todayStudyMins / 60).toFixed(1);

  return (
    <div className="rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-slate-200/80 bg-white">
      <div className={`h-1.5 w-full bg-gradient-to-r ${currentItem?.color || "from-indigo-500 to-teal-500"}`} />
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">PrepWise Cockpit</p>
            <h2 className="text-sm sm:text-base font-black text-slate-900 leading-snug">{greeting}</h2>
          </div>
          <div className={`shrink-0 flex flex-col items-center justify-center rounded-2xl px-3 py-2 ${streak > 0 ? "bg-orange-50 border border-orange-200" : "bg-slate-50 border border-slate-200"}`}>
            <span className="text-xl leading-none">{streak > 0 ? "🔥" : "💤"}</span>
            <span className={`text-sm font-black leading-tight ${streak > 0 ? "text-orange-600" : "text-slate-400"}`}>{streak}</span>
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{streak === 1 ? "Day" : "Days"}</span>
          </div>
        </div>

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

        <div className="w-full p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-black flex items-center mb-2.5 shadow-inner">
          <button
            type="button"
            onClick={() => setMode("motivation")}
            className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${mode === "motivation" ? "bg-white text-slate-900 shadow-sm font-black" : "text-slate-500 hover:text-slate-900"}`}
          >
            <span>🔥</span> Motivation
          </button>
          <button
            type="button"
            onClick={() => setMode("meme")}
            className={`flex-1 py-2 rounded-xl transition-all text-center flex items-center justify-center gap-1.5 ${mode === "meme" ? "bg-white text-slate-900 shadow-sm font-black" : "text-slate-500 hover:text-slate-900"}`}
          >
            <span>😂</span> Memes
          </button>
        </div>

        {currentItem && (
          <button
            type="button"
            onClick={() => pickNextItem(mode)}
            className={`w-full text-left rounded-2xl border ${currentItem.border} ${currentItem.bg} p-3 active:scale-[0.98] transition-all relative overflow-hidden group shadow-2xs`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center ${currentItem.badge} shadow-xs text-3xl`}>
                {currentItem.icon_or_sticker || "💡"}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${currentItem.text} leading-snug`}>"{currentItem.quote}"</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
                  <p className="text-[10px] font-black text-slate-600 truncate">— {currentItem.character}</p>
                  <span className="text-[9.5px] font-bold text-slate-500 bg-white/90 border border-slate-200/90 px-1.5 py-0.5 rounded-full shrink-0 shadow-2xs">Tap ↻</span>
                </div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 6. SYLLABUS COMPLETION WIDGET (GROUPED BY DISTINCT SUBJECTS) ─────────────
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

  // Clean group by normalized subject name (Physics, Chemistry, Maths/Biology)
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
        groups[normKey] = {
          name: cleanName,
          done: 0,
          total: 0,
          color: colorMap[normKey] || "#f59e0b",
        };
      }

      groups[normKey].done += doneCount;
      groups[normKey].total += totalCount;
      grandDone += doneCount;
      grandTotal += totalCount;
    });

    const subjectList = Object.values(groups).map((g) => ({
      name: g.name,
      done: g.done,
      total: g.total,
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
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
          <span>📚</span> Syllabus Completion
        </h3>
        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
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
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={s.color}
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={dasharray}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
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
                <span className="text-slate-500 text-[10px]">
                  {s.done}/{s.total} ({s.pct}%)
                </span>
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
        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-teal-800 font-bold text-xs rounded-xl border border-slate-200 transition-all text-center flex items-center justify-center gap-1"
      >
        <span>Go to Syllabus Tracker</span>
        <span>→</span>
      </button>
    </div>
  );
}

// ─── 7. COMBINED ACTION ITEMS WIDGET ─────────────────────────────────────────
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
      const todos = tasks
        .filter((t) => t.task_type !== "backlog")
        .map((t) => ({ id: t.id, title: t.title, priority: t.priority, itemType: "todo" as const, date: t.due_date }));
      combined.push(...todos);
    }
    if (filter === "all" || filter === "backlog") {
      const backlogs = tasks
        .filter((t) => t.task_type === "backlog")
        .map((t) => ({ id: t.id, title: t.title, priority: t.priority, itemType: "backlog" as const, date: t.due_date }));
      combined.push(...backlogs);
    }
    if (filter === "all" || filter === "tests") {
      const tests = scheduledTests.map((t) => ({
        id: t.id,
        title: t.test_name,
        priority: "medium",
        itemType: "test" as const,
        date: t.scheduled_date,
      }));
      combined.push(...tests);
    }

    return { items: combined.slice(0, 5), totalCount: combined.length };
  }, [tasks, scheduledTests, filter]);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
          <span>📋</span> Action Items
        </h3>
        <button
          type="button"
          onClick={onAddTask}
          className="text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg transition-all"
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
            <div
              key={it.id}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    it.itemType === "test"
                      ? "bg-indigo-600"
                      : it.priority === "high"
                      ? "bg-rose-600"
                      : it.priority === "medium"
                      ? "bg-amber-500"
                      : "bg-emerald-600"
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
        <button
          type="button"
          onClick={onViewAll}
          className="w-full text-center text-[11px] font-bold text-slate-600 hover:text-slate-900 pt-1 block"
        >
          View All ({totalCount}) →
        </button>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD PAGE ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  const [todayStudyMins, setTodayStudyMins] = useState(0);
  const [todayQuestions, setTodayQuestions] = useState(0);
  const [totalQuestionsAllTime, setTotalQuestionsAllTime] = useState(0);
  const [avgQPerHr, setAvgQPerHr] = useState(0);
  const [streak, setStreak] = useState(0);

  const [allPastLogs, setAllPastLogs] = useState<DailyLogItem[]>([]);
  const [allTasks, setAllTasks] = useState<TaskItem[]>([]);
  const [scheduledTests, setScheduledTests] = useState<ScheduledTest[]>([]);
  const [recentTests, setRecentTests] = useState<TestLog[]>([]);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [chapters, setChapters] = useState<ChapterItem[]>([]);
  const [chapterProgress, setChapterProgress] = useState<{ chapter_id: string; status: string }[]>([]);

  const [splitRatio, setSplitRatio] = useState({
    theory: 0,
    practice: 0,
    revision: 0,
    verified: 0,
  });

  const [examSchedules, setExamSchedules] = useState<ExamScheduleItem[]>([]);
  const [shiftsMap, setShiftsMap] = useState<Record<string, ExamShift[]>>({});
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

  // Question logging modal state
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [todayQuestionEntries, setTodayQuestionEntries] = useState<QuestionLogEntry[]>([]);
  const [selectedDistinctSubject, setSelectedDistinctSubject] = useState<string>("");
  const [qChapterId, setQChapterId] = useState("");
  const [qTopicName, setQTopicName] = useState("");
  const [qCount, setQCount] = useState("30");
  const [qStartFrom, setQStartFrom] = useState("1");
  const [qEndOn, setQEndOn] = useState("30");
  const [savingQuestion, setSavingQuestion] = useState(false);

  useEffect(() => {
    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);
      const uid = session.user.id;

      const { data: uProf } = await supabase.from("users").select("*").eq("uid", uid).maybeSingle();
      if (uProf) {
        setProfile(uProf);
        setSelectedShiftId(uProf.selected_shift_id || null);

        const targetExam = uProf.target_exam || "JEE";
        const allowedClasses = classLevelsForContent(uProf.class_level);

        // Fetch subjects
        const { data: rawSubs } = await supabase
          .from("subjects")
          .select("id, name, class_level, target_exam")
          .in("class_level", allowedClasses.length ? allowedClasses : ["11", "12"]);

        if (rawSubs) {
          // Strict Personalisation Filter
          const cleanedSubs = rawSubs.filter((s) => {
            if (!s.name || !s.name.trim()) return false;
            const norm = s.name.trim().toLowerCase();
            if (targetExam === "JEE") {
              // Exclude biology or NEET-only
              if (norm.includes("bio") || s.target_exam === "NEET") return false;
            } else if (targetExam === "NEET") {
              // Exclude maths or JEE-only
              if (norm.includes("math") || s.target_exam === "JEE") return false;
            }
            return true;
          });

          setSubjects(cleanedSubs);

          // Get unique distinct names for modal buttons
          const distinctNames = Array.from(new Set(cleanedSubs.map((s) => s.name.trim())));
          if (distinctNames[0]) {
            setSelectedDistinctSubject(distinctNames[0]);
          }

          const subIds = cleanedSubs.map((s) => s.id);
          const { data: chaps } = await supabase
            .from("chapters")
            .select("id, title, subject_id")
            .in("subject_id", subIds)
            .order("display_order", { ascending: true });

          if (chaps) {
            setChapters(chaps);
            const firstActiveSubIds = cleanedSubs
              .filter((s) => s.name.trim().toLowerCase() === distinctNames[0]?.toLowerCase())
              .map((s) => s.id);
            const initialChaps = chaps.filter((c) => firstActiveSubIds.includes(c.subject_id));
            if (initialChaps[0]) setQChapterId(initialChaps[0].id);
          }
        }
      }

      // Exam schedules
      const targetExam = uProf?.target_exam || "JEE";
      const targetYear = Number(uProf?.target_year) || 2027;
      const wantsBoards = uProf?.class_level !== "Dropper" && Boolean(uProf?.wants_boards);

      const { data: schedules } = await supabase
        .from("exam_schedule")
        .select("*")
        .eq("year", targetYear)
        .order("display_order", { ascending: true });

      let studentSchedules: ExamScheduleItem[] = [];
      if (schedules && schedules.length > 0) {
        studentSchedules = schedules.filter((s) => (s.target_exam === "Boards" ? wantsBoards : s.target_exam === targetExam || s.target_exam === "ALL"));
        const scheduleIds = studentSchedules.map((s) => s.id);
        const { data: shifts } = await supabase.from("exam_shifts").select("*").in("exam_schedule_id", scheduleIds);
        if (shifts) {
          const sMap: Record<string, ExamShift[]> = {};
          shifts.forEach((sh) => {
            if (!sMap[sh.exam_schedule_id]) sMap[sh.exam_schedule_id] = [];
            sMap[sh.exam_schedule_id].push(sh);
          });
          setShiftsMap(sMap);
        }
      }
      setExamSchedules(studentSchedules);

      const todayStr = new Date().toISOString().split("T")[0];

      // Daily logs & streak
      const { data: pastLogs } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, verified_minutes, streak_count, log_date")
        .eq("user_id", uid)
        .order("log_date", { ascending: false })
        .limit(84);

      if (pastLogs) {
        setAllPastLogs(pastLogs);
        const todayLog = pastLogs.find((l) => l.log_date === todayStr);
        setTodayStudyMins(todayLog?.study_time_minutes || 0);
        setSplitRatio({
          theory: todayLog?.theory_minutes || 0,
          practice: todayLog?.practice_minutes || 0,
          revision: todayLog?.revision_minutes || 0,
          verified: todayLog?.verified_minutes || 0,
        });

        const totalHoursAllTime = pastLogs.reduce((acc, l) => acc + (l.study_time_minutes || 0), 0) / 60;
        const { data: qLogs } = await supabase.from("question_logs").select("id, question_count, log_date, topic_name, start_from, end_on, subject_id, chapter_id").eq("user_id", uid);
        const totalQ = (qLogs || []).reduce((acc, q) => acc + (q.question_count || 0), 0);
        setTotalQuestionsAllTime(totalQ);
        const tQ = (qLogs || []).filter((q) => q.log_date === todayStr);
        setTodayQuestions(tQ.reduce((acc, q) => acc + (q.question_count || 0), 0));
        setTodayQuestionEntries(tQ as any);

        if (totalHoursAllTime > 0) {
          setAvgQPerHr(Math.round(totalQ / totalHoursAllTime));
        }
      }

      try {
        const streakInfo = await loadAndReconcileStreak(uid);
        setStreak(streakInfo.currentStreak);
      } catch {
        setStreak(uProf?.current_streak || 0);
      }

      // Chapter progress
      const { data: prog } = await supabase.from("chapter_progress").select("chapter_id, status").eq("user_id", uid);
      if (prog) setChapterProgress(prog);

      // Tasks
      const { data: userTasks } = await supabase.from("tasks").select("id, title, priority, status, task_type, due_date").eq("user_id", uid).neq("status", "completed").order("created_at", { ascending: false });
      if (userTasks) setAllTasks(userTasks);

      // Scheduled Tests
      try {
        const { data: schedTests } = await supabase.from("test_schedule").select("id, test_name, scheduled_date, subject, status").eq("user_id", uid).eq("status", "upcoming").order("scheduled_date", { ascending: true }).limit(5);
        if (schedTests) setScheduledTests(schedTests);
      } catch (_) {}

      // Recent Tests
      const { data: testData } = await supabase.from("test_logs").select("id, test_name, total_marks, max_marks, accuracy, test_date").eq("user_id", uid).order("test_date", { ascending: false }).limit(2);
      if (testData) setRecentTests(testData);

      setLoading(false);
    }

    loadData();
  }, [router]);

  // Distinct clean subject names for modal buttons
  const distinctSubjectNames = useMemo(() => {
    return Array.from(new Set(subjects.map((s) => s.name.trim()))).filter(Boolean);
  }, [subjects]);

  // Filter chapters based on selected distinct subject name
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
    if (chaps[0]) {
      setQChapterId(chaps[0].id);
    } else {
      setQChapterId("");
    }
  };

  const handleCompleteTask = async (id: string) => {
    setAllTasks((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
  };

  const handleCompleteTest = async (id: string) => {
    setScheduledTests((prev) => prev.filter((t) => t.id !== id));
    await supabase.from("test_schedule").update({ status: "completed" }).eq("id", id);
  };

  const handleSaveQuestionLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || savingQuestion) return;
    setSavingQuestion(true);

    const count = parseInt(qCount) || 0;
    const start = qStartFrom ? parseInt(qStartFrom) : null;
    const end = qEndOn ? parseInt(qEndOn) : null;
    const todayStr = new Date().toISOString().split("T")[0];

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
          log_date: todayStr,
          subject_id: matchingSubjectId,
          chapter_id: qChapterId || null,
          topic_name: qTopicName.trim(),
          question_count: count,
          start_from: start,
          end_on: end,
        })
        .select()
        .single();

      if (!error && data) {
        setTodayQuestions((prev) => prev + count);
        setTotalQuestionsAllTime((prev) => prev + count);
        setTodayQuestionEntries((prev) => [data as any, ...prev]);
        setShowAddQuestionModal(false);
        setQTopicName("");
      }
    } finally {
      setSavingQuestion(false);
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
        <p className="text-xs text-slate-400 mt-1">Loading dashboard telemetry…</p>
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
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-3.5 space-y-3">
        {/* 1. HERO WIDGET */}
        <HeroWidget name={firstName} streak={streak} todayStudyMins={todayStudyMins} />

        {/* 2. EXAM COUNTDOWN */}
        <div className={`grid gap-2 ${examSchedules.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {examSchedules.map((exam) => {
            const days = calculateDaysLeft(exam.exam_date);
            const shifts = shiftsMap[exam.id] || [];

            return (
              <div key={exam.id} className="rounded-2xl p-3 bg-[#0B132B] text-white shadow-md border border-slate-800 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[9.5px] font-black uppercase text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md border border-amber-400/30 truncate">
                    {exam.label}
                  </span>
                  <span className="text-[8.5px] font-semibold text-slate-400">{exam.is_confirmed ? "Official" : "Proj."}</span>
                </div>
                <div className="flex items-baseline justify-between mt-1 mb-1">
                  <div className="text-2xl font-black text-amber-400 leading-none">
                    {days}
                    <span className="text-[9.5px] font-bold text-slate-300 uppercase ml-1">Days</span>
                  </div>
                  <div className="text-[10px] text-slate-300">
                    {new Date(exam.exam_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  </div>
                </div>
                {shifts.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-white/10">
                    <select
                      value={selectedShiftId || ""}
                      onChange={(e) => setSelectedShiftId(e.target.value)}
                      className="w-full bg-slate-800/90 text-white rounded-lg px-2 py-1 border border-slate-700 text-[9.5px]"
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

        {/* 3. AI MENTOR WIDGET */}
        <AiMentorCard
          userId={user?.id}
          targetExam={profile?.target_exam || "JEE"}
          report={mentorReport}
          loading={mentorLoading}
          onRefresh={() => {}}
          onOpenDoubtSolver={() => setDoubtOpen(true)}
        />

        {/* 4. METRICS ROW (UPGRADED QUESTIONS CARD) */}
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
            </div>
            <span className="text-[10px] font-bold text-teal-700 block mt-0.5">Study Timer →</span>
          </button>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-600 block">Questions</span>
                <button
                  type="button"
                  onClick={() => setShowAddQuestionModal(true)}
                  className="text-[9.5px] font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 hover:bg-teal-100"
                >
                  +Add
                </button>
              </div>
              <div className="text-lg font-black text-slate-900 tracking-tight mt-0.5">{todayQuestions}</div>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-100 text-[9px] font-semibold text-slate-500 flex flex-col">
              <span>All: {totalQuestionsAllTime}</span>
              <span className="text-indigo-700 font-bold">Avg: {avgQPerHr} Q/hr</span>
            </div>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <span className="text-[10px] font-bold text-slate-600 block mb-0.5">Backlogs</span>
            <div className="text-lg font-black text-slate-900 tracking-tight">
              {allTasks.filter((t) => t.task_type === "backlog").length}
            </div>
            <span className="text-[10px] font-bold text-rose-600 block mt-0.5">Pending</span>
          </div>
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
            <div style={{ width: `${sumSplit > 0 ? theoryPct : 33}%` }} className="bg-amber-500 transition-all" />
            <div style={{ width: `${sumSplit > 0 ? practicePct : 50}%` }} className="bg-teal-600 transition-all" />
            <div style={{ width: `${sumSplit > 0 ? revisionPct : 17}%` }} className="bg-indigo-600 transition-all" />
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

          {splitRatio.verified > 0 && (
            <div className="mt-2.5 flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
              <span className="text-sm">🛡️</span>
              <div className="flex-1">
                <span className="text-[11px] font-bold text-teal-800">
                  {splitRatio.verified}m Verified (Leaderboard Counted)
                </span>
                <p className="text-[10px] text-teal-600 mt-0.5">Face cam + App blocker both ON</p>
              </div>
              <span className="text-xs font-black text-teal-700">
                {Math.round((splitRatio.verified / Math.max(todayStudyMins, 1)) * 100)}%
              </span>
            </div>
          )}
        </div>

        {/* 6. SYLLABUS COMPLETION WIDGET (CLEAN 3 SUBJECTS DONUT) */}
        <SyllabusCompletionWidget
          subjects={subjects}
          chapters={chapters}
          progress={chapterProgress}
          onOpenSyllabus={() => router.push("/library")}
        />

        {/* 7. COMBINED ACTION ITEMS (TO-DO / BACKLOG / TESTS) */}
        <ActionItemsWidget
          tasks={allTasks}
          scheduledTests={scheduledTests}
          onCompleteTask={handleCompleteTask}
          onCompleteTest={handleCompleteTest}
          onAddTask={() => router.push("/todo")}
          onViewAll={() => router.push("/todo")}
        />

        {/* 8. RECENT MOCK TESTS (LIMIT 2) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <span>📈</span> Recent Mock Performance
            </span>
            <button type="button" onClick={() => router.push("/tests")} className="text-[11px] font-bold text-indigo-700 hover:underline">
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
              {recentTests.slice(0, 2).map((t) => (
                <div key={t.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
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

        {/* 9. QUICK ROUTE CARDS (3-COLUMN) */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="text-xl mb-1">📚</div>
            <div>
              <div className="text-xs font-black text-slate-900">Syllabus</div>
              <div className="text-[9px] font-semibold text-slate-500">Chapters & Scope</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all flex flex-col justify-between"
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
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-all flex flex-col justify-between"
          >
            <div className="text-xl mb-1">📈</div>
            <div>
              <div className="text-xs font-black text-slate-900">Analytics</div>
              <div className="text-[9px] font-semibold text-slate-500">Charts & Heatmap</div>
            </div>
          </button>
        </div>
      </main>

      {/* QUESTION LOGGING MODAL (CLEAN 3 DISTINCT SUBJECT BUTTONS) */}
      {showAddQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
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
              <div className="p-3 bg-slate-100/80 border-b border-slate-200 text-xs">
                <span className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Today's Entries</span>
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {todayQuestionEntries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-bold">
                      <span className="truncate text-slate-800">{e.topic_name || "Practice Session"}</span>
                      <span className="text-teal-700 shrink-0 ml-2">+{e.question_count} Qs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveQuestionLog} className="p-4 space-y-3 overflow-y-auto text-xs">
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
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
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
                  className="flex-1 py-2.5 rounded-xl bg-teal-600 text-white font-black text-xs hover:bg-teal-700 disabled:opacity-50 shadow-md"
                >
                  {savingQuestion ? "Saving…" : "Save Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Doubt Solver Sheet */}
      <AiChatSheet open={doubtOpen} onClose={() => setDoubtOpen(false)} />

      <BottomNav />
    </div>
  );
}
