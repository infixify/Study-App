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

interface DashboardState {
  name: string;
  streak: number;
  targetExam: string | null;
  examDate: string | null;
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
  examDate: null,
  studiedMinutesToday: 0,
  targetMinutesToday: 240,
  tasks: [],
  accuracy: 0,
  consistency: 0,
};

// TODO: move this somewhere central (env var / admin-configurable) once
// multiple exam dates / exams need to be supported per user.
const EXAM_DATE_BY_TARGET: Record<string, string> = {
  JEE: "2027-01-24",
  NEET: "2027-05-03",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
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

      const [
        { data: profile },
        { data: todayLog },
        { data: recentLogs },
        { data: taskRows },
        { data: attempts },
      ] = await Promise.all([
        supabase
          .from("users")
          .select("name, target_exam")
          .eq("uid", user.id)
          .maybeSingle(),
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
      ]);

      if (cancelled) return;

      // Streak: today's row if it exists, else most recent row we fetched.
      const streak =
        todayLog?.streak_count ??
        recentLogs?.[0]?.streak_count ??
        0;

      // Consistency: % of last 14 days with any logged study time.
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

      const targetExam = profile?.target_exam ?? null;

      setState({
        name: profile?.name || "Student",
        streak,
        targetExam,
        examDate: targetExam ? EXAM_DATE_BY_TARGET[targetExam] ?? null : null,
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

  return (
    <div className="min-h-screen bg-paper pb-28">
      <div className="max-w-md mx-auto px-5 pt-8">
        <GreetingHeader name={state.name} streak={state.streak} />

        {state.examDate && (
          <CountdownCard
            examDate={state.examDate}
            examLabel={state.targetExam === "JEE" ? "JEE Mains" : state.targetExam ?? ""}
          />
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
