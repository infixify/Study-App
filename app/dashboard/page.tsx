// app/dashboard/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase, classLevelsForContent } from "@/lib/supabase";
import GreetingHeader from "@/components/dashboard/GreetingHeader";
import CountdownCard from "@/components/dashboard/CountdownCard";
import StudyTimeTracker from "@/components/dashboard/StudyTimeTracker";
import TaskWidget from "@/components/dashboard/TaskWidget";
import AnalyticsRadar from "@/components/dashboard/AnalyticsRadar";
import BottomNav from "@/components/dashboard/BottomNav";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

type TaskItem = {
  id: string;
  title: string;
  type: "todo" | "backlog";
  done: boolean;
};

type ExamScheduleRow = {
  id: string;
  exam_key: string;
  label: string;
  exam_date: string;
  is_confirmed: boolean;
};

type ExamShiftRow = {
  id: string;
  exam_schedule_id: string;
  shift_date: string;
  shift_time: string;
};

const TARGET_YEARS = [2027, 2028, 2029, 2030];

const ESTIMATED_DATES: Record<string, { month: number; day: number; label: string }> = {
  JEE_MAINS: { month: 1, day: 24, label: "JEE Main Session 1" },
  JEE_ADVANCED: { month: 5, day: 25, label: "JEE Advanced" },
  NEET: { month: 5, day: 5, label: "NEET UG" },
  BOARDS: { month: 2, day: 15, label: "Board Exams begin" },
};

function estimatedDateFor(key: keyof typeof ESTIMATED_DATES, year: number): string {
  const { month, day } = ESTIMATED_DATES[key];
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface DashboardState {
  name: string;
  streak: number;
  targetExam: string | null;
  targetYear: number;
  selectedShiftId: string | null;
  mainsCountdown: { exam_date: string; label: string; isEstimate: boolean } | null;
  mainsShifts: ExamShiftRow[];
  advancedCountdown: { exam_date: string; label: string; isEstimate: boolean } | null;
  singleCountdown: { exam_date: string; label: string; isEstimate: boolean } | null;
  studiedMinutesToday: number;
  targetMinutesToday: number;
  recentLogs: { log_date: string; study_time_minutes: number; target_minutes: number }[];
  tasks: TaskItem[];
  accuracy: number;
  consistency: number;
  syllabusProgress: { doneChapters: number; totalChapters: number; pct: number };
}

const EMPTY_STATE: DashboardState = {
  name: "",
  streak: 0,
  targetExam: null,
  targetYear: 2027,
  selectedShiftId: null,
  mainsCountdown: null,
  mainsShifts: [],
  advancedCountdown: null,
  singleCountdown: null,
  studiedMinutesToday: 0,
  targetMinutesToday: 240,
  recentLogs: [],
  tasks: [],
  accuracy: 0,
  consistency: 0,
  syllabusProgress: { doneChapters: 0, totalChapters: 0, pct: 0 },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function pickNextMainsSession(sessions: ExamScheduleRow[]): ExamScheduleRow | null {
  if (!sessions.length) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = sessions
    .filter((s) => new Date(s.exam_date) >= today)
    .sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime());

  if (upcoming.length) return upcoming[0];

  return sessions
    .slice()
    .sort((a, b) => new Date(b.exam_date).getTime() - new Date(a.exam_date).getTime())[0];
}

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(false);
  const [state, setState] = useState<DashboardState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [savingYear, setSavingYear] = useState(false);
  const [savingShift, setSavingShift] = useState(false);

  const load = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const today = todayISO();

    const { data: profile } = await supabase
      .from("users")
      .select("name, target_exam, target_year, selected_shift_id, class_level")
      .eq("uid", user.id)
      .maybeSingle();

    const targetExam = profile?.target_exam ?? null;
    const targetYear = profile?.target_year ?? 2027;
    const selectedShiftId = profile?.selected_shift_id ?? null;
    const classLevel = profile?.class_level ?? null;

    const [
      { data: todayLog },
      { data: recentLogs },
      { data: taskRows },
      { data: testLogs },
      { data: scheduleRows },
    ] = await Promise.all([
      supabase
        .from("daily_logs")
        .select("study_time_minutes, target_minutes, streak_count")
        .eq("user_id", user.id)
        .eq("log_date", today)
        .maybeSingle(),
      supabase
        .from("daily_logs")
        .select("log_date, study_time_minutes, target_minutes, streak_count")
        .eq("user_id", user.id)
        .gte("log_date", daysAgoISO(29))
        .order("log_date", { ascending: false }),
      supabase
        .from("tasks")
        .select("id, title, task_type, status, due_date")
        .eq("user_id", user.id)
        .lte("due_date", today)
        .neq("status", "completed")
        .order("due_date", { ascending: true })
        .limit(10),
      supabase
        .from("test_logs")
        .select("accuracy, test_date")
        .eq("user_id", user.id)
        .not("accuracy", "is", null)
        .order("test_date", { ascending: false })
        .limit(10),
      targetExam
        ? supabase
            .from("exam_schedule")
            .select("id, exam_key, label, exam_date, is_confirmed")
            .eq("target_exam", targetExam)
            .eq("year", targetYear)
            .order("display_order", { ascending: true })
        : Promise.resolve({ data: [] as ExamScheduleRow[] }),
    ]);

    const streak = todayLog?.streak_count ?? recentLogs?.[0]?.streak_count ?? 0;

    // consistency still uses last 14 days of the 30-day set fetched above
    const last14 = (recentLogs ?? []).slice(0, 14);
    const daysWithStudy = last14.filter((r) => (r.study_time_minutes ?? 0) > 0).length;
    const consistency = last14.length
      ? Math.round((daysWithStudy / last14.length) * 100)
      : 0;

    const validAccuracies =
      testLogs?.map((t) => t.accuracy).filter((a): a is number => a != null) ?? [];
    const accuracy = validAccuracies.length
      ? Math.round(
          validAccuracies.reduce((sum, a) => sum + a, 0) / validAccuracies.length
        )
      : 0;

    const tasks: TaskItem[] =
      taskRows?.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.task_type as "todo" | "backlog",
        done: t.status === "completed",
      })) ?? [];

    const rows = (scheduleRows as ExamScheduleRow[] | null) ?? [];

    let mainsCountdown: DashboardState["mainsCountdown"] = null;
    let advancedCountdown: DashboardState["advancedCountdown"] = null;
    let singleCountdown: DashboardState["singleCountdown"] = null;
    let mainsShifts: ExamShiftRow[] = [];

    if (targetExam === "JEE") {
      const mainsSessions = rows.filter((r) => r.exam_key.startsWith("JEE_MAINS"));
      const mainsRow = pickNextMainsSession(mainsSessions);
      const advancedRow = rows.find((r) => r.exam_key === "JEE_ADVANCED") ?? null;

      mainsCountdown = mainsRow
        ? { exam_date: mainsRow.exam_date, label: mainsRow.label, isEstimate: false }
        : { exam_date: estimatedDateFor("JEE_MAINS", targetYear), label: ESTIMATED_DATES.JEE_MAINS.label, isEstimate: true };

      advancedCountdown = advancedRow
        ? { exam_date: advancedRow.exam_date, label: advancedRow.label, isEstimate: false }
        : { exam_date: estimatedDateFor("JEE_ADVANCED", targetYear), label: ESTIMATED_DATES.JEE_ADVANCED.label, isEstimate: true };

      if (mainsRow) {
        const { data: shiftRows } = await supabase
          .from("exam_shifts")
          .select("id, exam_schedule_id, shift_date, shift_time")
          .eq("exam_schedule_id", mainsRow.id)
          .order("display_order", { ascending: true });
        mainsShifts = (shiftRows as ExamShiftRow[] | null) ?? [];
      }
    } else if (targetExam) {
      const key = targetExam === "NEET" ? "NEET" : "BOARDS";
      const row = rows[0] ?? null;
      singleCountdown = row
        ? { exam_date: row.exam_date, label: row.label, isEstimate: false }
        : { exam_date: estimatedDateFor(key, targetYear), label: ESTIMATED_DATES[key].label, isEstimate: true };
    }

    let syllabusProgress: DashboardState["syllabusProgress"] = { doneChapters: 0, totalChapters: 0, pct: 0 };

    if (targetExam && classLevel) {
      const classLevels = classLevelsForContent(classLevel as any);

      const { data: subjectRows } = await supabase
        .from("subjects")
        .select("id, class_level")
        .eq("target_exam", targetExam)
        .in("class_level", classLevels);

      const subjectIds = (subjectRows ?? []).map((s) => s.id);

      if (subjectIds.length) {
        const dropperIds = (subjectRows ?? [])
          .filter((s) => s.class_level === "Dropper")
          .map((s) => s.id);

        const { data: chapterRows } = await supabase
          .from("chapters")
          .select("id, subject_id, in_competitive_syllabus")
          .in("subject_id", subjectIds);

        const relevantChapters = (chapterRows ?? []).filter((c) => {
          if (dropperIds.includes(c.subject_id)) return c.in_competitive_syllabus !== false;
          return true;
        });

        const chapterIds = relevantChapters.map((c) => c.id);

        const { data: progressRows } = chapterIds.length
          ? await supabase
              .from("chapter_progress")
              .select("chapter_id, status")
              .eq("user_id", user.id)
              .in("chapter_id", chapterIds)
          : { data: [] as { chapter_id: string; status: string }[] };

        const doneChapters = (progressRows ?? []).filter((p) => p.status === "done").length;
        const totalChapters = relevantChapters.length;
        const pct = totalChapters > 0 ? Math.round((doneChapters / totalChapters) * 100) : 0;

        syllabusProgress = { doneChapters, totalChapters, pct };
      }
    }

    setState({
      name: profile?.name || "Student",
      streak,
      targetExam,
      targetYear,
      selectedShiftId,
      mainsCountdown,
      mainsShifts,
      advancedCountdown,
      singleCountdown,
      studiedMinutesToday: todayLog?.study_time_minutes ?? 0,
      targetMinutesToday: todayLog?.target_minutes ?? 240,
      recentLogs: (recentLogs ?? []).map((r) => ({
        log_date: r.log_date,
        study_time_minutes: r.study_time_minutes,
        target_minutes: r.target_minutes ?? 240,
      })),
      tasks,
      accuracy,
      consistency,
      syllabusProgress,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleYearChange(newYear: number) {
    setSavingYear(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (user) {
      await supabase
        .from("users")
        .update({ target_year: newYear, selected_shift_id: null })
        .eq("uid", user.id);
      await load();
    }
    setSavingYear(false);
  }

  async function handleShiftChange(shiftId: string) {
    setSavingShift(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (user) {
      await supabase
        .from("users")
        .update({ selected_shift_id: shiftId || null })
        .eq("uid", user.id);
      await load();
    }
    setSavingShift(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading your dashboard…</p>
      </div>
    );
  }

  function labelFor(row: { label: string; isEstimate: boolean }) {
    return row.isEstimate ? `${row.label} (estimated)` : row.label;
  }

  const selectedMainsShift = state.mainsShifts.find((s) => s.id === state.selectedShiftId) ?? null;

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <GreetingHeader name={state.name} streak={state.streak} />

        {state.targetExam && (
          <div className="mt-4 flex items-center justify-between text-xs">
            <span className="text-slate">Targeting</span>
            <select
              value={state.targetYear}
              disabled={savingYear}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              className="rounded-full border border-ink/15 bg-white px-3 py-1 text-xs font-medium disabled:opacity-50"
            >
              {TARGET_YEARS.map((y) => (
                <option key={y} value={y}>
                  {state.targetExam} {y}
                </option>
              ))}
            </select>
          </div>
        )}

        {state.targetExam === "JEE" ? (
          <>
            {state.mainsCountdown && (
              <CountdownCard
                examDate={selectedMainsShift ? selectedMainsShift.shift_date : state.mainsCountdown.exam_date}
                examLabel={labelFor(state.mainsCountdown)}
              />
            )}

            {state.mainsShifts.length > 0 && (
              <div className="mt-3 rounded-ticket border border-ink/10 bg-white p-4">
                <p className="text-sm font-medium mb-1">Your exam shift</p>
                <p className="text-xs text-slate mb-3">
                  Pick the exact date + shift from your admit card for the most accurate countdown.
                </p>
                <select
                  value={state.selectedShiftId ?? ""}
                  disabled={savingShift}
                  onChange={(e) => handleShiftChange(e.target.value)}
                  className="w-full rounded-ticket border border-ink/15 bg-white p-3 text-sm disabled:opacity-50"
                >
                  <option value="">Not selected yet — using session date</option>
                  {state.mainsShifts.map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {new Date(shift.shift_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      — {shift.shift_time}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {state.advancedCountdown && (
              <div className="mt-3">
                <CountdownCard
                  examDate={state.advancedCountdown.exam_date}
                  examLabel={labelFor(state.advancedCountdown)}
                />
              </div>
            )}
          </>
        ) : (
          state.singleCountdown && (
            <CountdownCard
              examDate={state.singleCountdown.exam_date}
              examLabel={labelFor(state.singleCountdown)}
            />
          )
        )}

        <StudyTimeTracker
          studiedMinutes={state.studiedMinutesToday}
          targetMinutes={state.targetMinutesToday}
          recentLogs={state.recentLogs}
        />

        <div className="mt-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium text-ink">Upcoming tasks</p>
            <Link href="/todo" className="text-xs text-teal font-medium">
              View all →
            </Link>
          </div>
          <TaskWidget tasks={state.tasks} />
        </div>

        {state.syllabusProgress.totalChapters > 0 && (
          <div className="mt-3 rounded-ticket border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Syllabus Progress</p>
              <span className="text-xs font-semibold text-teal">
                {state.syllabusProgress.pct}%
              </span>
            </div>
            <div className="w-full h-2 bg-ink/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal transition-all"
                style={{ width: `${state.syllabusProgress.pct}%` }}
              />
            </div>
            <p className="text-[11px] text-slate mt-1.5">
              {state.syllabusProgress.doneChapters}/{state.syllabusProgress.totalChapters} chapters marked done
            </p>
          </div>
        )}

        <AnalyticsRadar
          accuracy={state.accuracy}
          consistency={state.consistency}
        />
      </div>

      <button
        onClick={() => setChatOpen(true)}
        aria-label="Open AI study mentor"
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-ink text-paper shadow-lg shadow-ink/20 flex items-center justify-center text-xl hover:scale-105 active:scale-95 transition-transform z-30"
      >
        ✨
      </button>

      <AiChatSheet open={chatOpen} onClose={() => setChatOpen(false)} />

      <BottomNav />
    </div>
  );
      }
