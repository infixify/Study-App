// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
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
  exam_key: string;
  label: string;
  exam_date: string;
  is_confirmed: boolean;
};

interface DashboardState {
  name: string;
  streak: number;
  targetExam: string | null;
  // JEE gets two separate countdowns; NEET (or anything else) gets one.
  mainsCountdown: ExamScheduleRow | null;
  advancedCountdown: ExamScheduleRow | null;
  singleCountdown: ExamScheduleRow | null;
  studiedMinutesToday: number;
  targetMinutesToday: number;
  tasks: TaskItem[];
  accuracy: number;
  consistency: number;
}

const EMPTY_STATE: DashboardState = {
  name: "",
  streak: 0,
  targetExam: null,
  mainsCountdown: null,
  advancedCountdown: null,
  singleCountdown: null,
  studiedMinutesToday: 0,
  targetMinutesToday: 240,
  tasks: [],
  accuracy: 0,
  consistency: 0,
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Of the JEE Main session rows, pick whichever hasn't passed yet (soonest first).
// If both sessions have already passed, fall back to showing the later one.
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const today = todayISO();

      const { data: profile } = await supabase
        .from("users")
        .select("name, target_exam")
        .eq("uid", user.id)
        .maybeSingle();

      const targetExam = profile?.target_exam ?? null;

      const [
        { data: todayLog },
        { data: recentLogs },
        { data: taskRows },
        { data: attempts },
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
          .select("log_date, study_time_minutes, streak_count")
          .eq("user_id", user.id)
          .gte("log_date", daysAgoISO(13))
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
          .from("test_attempts")
          .select("accuracy, submitted_at")
          .eq("user_id", user.id)
          .not("submitted_at", "is", null)
          .order("submitted_at", { ascending: false })
          .limit(10),
        targetExam
          ? supabase
              .from("exam_schedule")
              .select("exam_key, label, exam_date, is_confirmed")
              .eq("target_exam", targetExam)
              .order("display_order", { ascending: true })
          : Promise.resolve({ data: [] as ExamScheduleRow[] }),
      ]);

      if (cancelled) return;

      const streak = todayLog?.streak_count ?? recentLogs?.[0]?.streak_count ?? 0;

      const daysWithStudy =
        recentLogs?.filter((r) => (r.study_time_minutes ?? 0) > 0).length ?? 0;
      const consistency = recentLogs?.length
        ? Math.round((daysWithStudy / recentLogs.length) * 100)
        : 0;

      const validAccuracies =
        attempts?.map((a) => a.accuracy).filter((a): a is number => a != null) ?? [];
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

      let mainsCountdown: ExamScheduleRow | null = null;
      let advancedCountdown: ExamScheduleRow | null = null;
      let singleCountdown: ExamScheduleRow | null = null;

      if (targetExam === "JEE") {
        const mainsSessions = rows.filter((r) => r.exam_key.startsWith("JEE_MAINS"));
        mainsCountdown = pickNextMainsSession(mainsSessions);
        advancedCountdown = rows.find((r) => r.exam_key === "JEE_ADVANCED") ?? null;
      } else {
        // NEET, Boards, or anything else with a single row.
        singleCountdown = rows[0] ?? null;
      }

      setState({
        name: profile?.name || "Student",
        streak,
        targetExam,
        mainsCountdown,
        advancedCountdown,
        singleCountdown,
        studiedMinutesToday: todayLog?.study_time_minutes ?? 0,
        targetMinutesToday: todayLog?.target_minutes ?? 240,
        tasks,
        accuracy,
        consistency,
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading your dashboard…</p>
      </div>
    );
  }

  // "(tentative)" suffix flags exam-schedule rows the board hasn't officially
  // confirmed yet — see exam_schedule.is_confirmed. Keeps CountdownCard itself untouched.
  function labelFor(row: ExamScheduleRow) {
    return row.is_confirmed ? row.label : `${row.label} (tentative)`;
  }

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <GreetingHeader name={state.name} streak={state.streak} />

        {state.targetExam === "JEE" ? (
          <>
            {state.mainsCountdown && (
              <CountdownCard
                examDate={state.mainsCountdown.exam_date}
                examLabel={labelFor(state.mainsCountdown)}
              />
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
        />

        <TaskWidget tasks={state.tasks} />

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
