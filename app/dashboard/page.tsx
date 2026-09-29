// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/BottomNav";
import AiMentorCard from "@/components/dashboard/AiMentorCard";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  subject?: string;
  status: string;
}

interface TestItem {
  id: string;
  test_name: string;
  total_marks: number;
  max_marks: number;
  accuracy: number;
  test_date: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Mentor & Doubt sheet state
  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  // Core JEETrack Telemetry States
  const [stats, setStats] = useState({
    todayMinutes: 0,
    streak: 0,
    backlogCount: 0,
    theoryMins: 0,
    practiceMins: 0,
    revisionMins: 0,
  });

  const [weeklyLogs, setWeeklyLogs] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [backlogs, setBacklogs] = useState<TaskItem[]>([]);
  const [latestTests, setLatestTests] = useState<TestItem[]>([]);
  const [newBacklogTitle, setNewBacklogTitle] = useState("");
  const [showAddBacklog, setShowAddBacklog] = useState(false);

  // Exam Countdown calculation (JEE 2027 default: 22 Jan 2027)
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    // Exam date calculator
    const examDate = new Date("2027-01-22T09:00:00");
    const diffTime = examDate.getTime() - new Date().getTime();
    setDaysLeft(Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))));

    async function loadData() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/");
        return;
      }
      setUser(session.user);

      // Fetch user profile
      const { data: uProf } = await supabase
        .from("users")
        .select("*")
        .eq("uid", session.user.id)
        .maybeSingle();

      if (uProf) {
        setProfile(uProf);
        fetchMentorReport(session.user.id);
      }

      // Fetch Recent 7 Days Logs
      const { data: pastLogs } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, streak_count, log_date")
        .eq("user_id", session.user.id)
        .order("log_date", { ascending: false })
        .limit(7);

      const todayStr = new Date().toISOString().split("T")[0];
      const todayLog = pastLogs?.find((l) => l.log_date === todayStr);

      // Aggregate Weekly heatmap (Last 7 days)
      const heatArray = [0, 0, 0, 0, 0, 0, 0];
      if (pastLogs && pastLogs.length > 0) {
        pastLogs.forEach((l, idx) => {
          if (idx < 7) heatArray[6 - idx] = Math.round((l.study_time_minutes || 0) / 60);
        });
      }
      setWeeklyLogs(heatArray);

      // Total Today splits
      setStats({
        todayMinutes: todayLog?.study_time_minutes || 0,
        streak: todayLog?.streak_count || (pastLogs?.[0]?.streak_count ?? 0),
        backlogCount: 0,
        theoryMins: todayLog?.theory_minutes || 0,
        practiceMins: todayLog?.practice_minutes || 0,
        revisionMins: todayLog?.revision_minutes || 0,
      });

      // Fetch Unresolved Backlogs
      const { data: backlogData } = await supabase
        .from("tasks")
        .select("id, title, priority, subject, status")
        .eq("user_id", session.user.id)
        .eq("task_type", "backlog")
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(5);

      if (backlogData) {
        setBacklogs(backlogData);
        setStats((prev) => ({ ...prev, backlogCount: backlogData.length }));
      }

      // Fetch Recent Mock Tests
      const { data: testData } = await supabase
        .from("test_logs")
        .select("id, test_name, total_marks, max_marks, accuracy, test_date")
        .eq("user_id", session.user.id)
        .order("test_date", { ascending: false })
        .limit(3);

      if (testData) setLatestTests(testData);

      setLoading(false);
    }

    loadData();
  }, [router]);

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
      }
    } catch (e) {
      console.error("Mentor fetch error:", e);
    } finally {
      setMentorLoading(false);
    }
  };

  // Quick Backlog complete handler
  const handleCompleteBacklog = async (taskId: string) => {
    setBacklogs((prev) => prev.filter((b) => b.id !== taskId));
    setStats((prev) => ({ ...prev, backlogCount: Math.max(0, prev.backlogCount - 1) }));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
  };

  // Quick Add Backlog
  const handleAddBacklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBacklogTitle.trim() || !user) return;

    const newTask = {
      user_id: user.id,
      title: newBacklogTitle.trim(),
      task_type: "backlog",
      priority: "high",
      status: "pending",
    };

    const { data } = await supabase.from("tasks").insert(newTask).select().single();
    if (data) {
      setBacklogs((prev) => [data, ...prev]);
      setStats((prev) => ({ ...prev, backlogCount: prev.backlogCount + 1 }));
    }
    setNewBacklogTitle("");
    setShowAddBacklog(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center text-xs font-bold text-slate">
        <span className="animate-spin mr-2">⏳</span> Loading PrepWise Dashboard…
      </div>
    );
  }

  const studentName = profile?.name || user?.user_metadata?.full_name?.split(" ")[0] || "Aspirant";
  const targetExam = profile?.target_exam || "JEE";
  const targetYear = profile?.target_year || "2027";
  const todayHours = (stats.todayMinutes / 60).toFixed(1);

  // Practice to Theory calculation
  const totalLoggedMins = stats.theoryMins + stats.practiceMins + stats.revisionMins || 1;
  const theoryPercent = Math.round((stats.theoryMins / totalLoggedMins) * 100);
  const practicePercent = Math.round((stats.practiceMins / totalLoggedMins) * 100);
  const revisionPercent = Math.round((stats.revisionMins / totalLoggedMins) * 100);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-28 text-ink">
      {/* 1. TOP STICKY NAVBAR */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-ink/8 px-4 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal text-white flex items-center justify-center font-black text-xs shadow-xs">
              PW
            </span>
            <div>
              <h1 className="text-xs font-black tracking-tight text-ink leading-none">PrepWise</h1>
              <span className="text-[10px] font-bold text-slate">
                {targetExam} {targetYear} • Kota Engine
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak Counter */}
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-xl text-amber-800 text-[11px] font-black">
              <span>🔥</span>
              <span>{stats.streak}d</span>
            </div>

            {/* Profile Avatar */}
            <div className="w-7 h-7 rounded-full bg-ink text-paper flex items-center justify-center text-xs font-bold shadow-2xs">
              {studentName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-md mx-auto px-4 pt-3.5 space-y-3.5">
        {/* 2. EXAM COUNTDOWN HERO BANNER (JEETrack Style) */}
        <div className="rounded-2xl p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md relative overflow-hidden flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
              {targetExam} {targetYear} TARGET
            </div>
            <div className="text-xs font-semibold text-slate-200 mt-0.5">
              Every single hour counts towards your AIR
            </div>
          </div>
          <div className="text-right bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 backdrop-blur-xs flex-shrink-0">
            <div className="text-lg font-black tracking-tight leading-none text-amber-400">
              {daysLeft}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-300">
              Days Left
            </div>
          </div>
        </div>

        {/* 3. COMPACT AI MENTOR WIDGET (With 1-Tap Doubt Solver) */}
        <AiMentorCard
          userId={user?.id}
          report={mentorReport}
          loading={mentorLoading}
          onRefresh={() => fetchMentorReport(user?.id, true)}
          onOpenDoubtSolver={() => setDoubtOpen(true)}
        />

        {/* 4. THREE CRITICAL COCKPIT METRICS */}
        <div className="grid grid-cols-3 gap-2">
          {/* Today Study */}
          <div className="bg-white p-3 rounded-2xl border border-ink/8 shadow-2xs">
            <span className="text-[10px] font-bold text-slate block mb-0.5">Today Study</span>
            <div className="text-base font-black text-ink">
              {todayHours}
              <span className="text-[10px] font-semibold text-slate">h</span>
            </div>
            <span className="text-[9.5px] font-bold text-teal block mt-0.5">Target: 6.0h</span>
          </div>

          {/* Unresolved Backlogs */}
          <div className="bg-white p-3 rounded-2xl border border-ink/8 shadow-2xs">
            <span className="text-[10px] font-bold text-slate block mb-0.5">Backlogs</span>
            <div className="text-base font-black text-ink">{stats.backlogCount}</div>
            <span
              className={`text-[9.5px] font-bold block mt-0.5 ${
                stats.backlogCount > 0 ? "text-rose-500" : "text-emerald-600"
              }`}
            >
              {stats.backlogCount > 0 ? "Requires Push" : "Clean Slate ✓"}
            </span>
          </div>

          {/* Quick Study Launcher */}
          <button
            type="button"
            onClick={() => router.push("/study")}
            className="bg-indigo-50/70 hover:bg-indigo-100/70 border border-indigo-200/80 p-3 rounded-2xl text-left transition-all active:scale-[0.98]"
          >
            <span className="text-[10px] font-bold text-indigo-700 block mb-0.5">Focus Mode</span>
            <div className="text-xs font-black text-indigo-950">Start Timer</div>
            <span className="text-[9.5px] font-bold text-indigo-600 block mt-0.5">⏱ 90m Slot</span>
          </button>
        </div>

        {/* 5. EFFICIENCY RATIO INDEX (P:T Ratio Analyzer) */}
        <div className="bg-white p-3.5 rounded-2xl border border-ink/8 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-ink flex items-center gap-1.5">
              <span>⚖️</span> Study Split Ratio
            </span>
            <span className="text-[10px] font-bold text-slate">
              Rule: 60% Practice Target
            </span>
          </div>

          {/* Progress bar split */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-2">
            <div
              style={{ width: `${stats.todayMinutes > 0 ? theoryPercent : 33}%` }}
              className="bg-amber-400 transition-all"
              title="Theory"
            />
            <div
              style={{ width: `${stats.todayMinutes > 0 ? practicePercent : 50}%` }}
              className="bg-teal transition-all"
              title="Practice"
            />
            <div
              style={{ width: `${stats.todayMinutes > 0 ? revisionPercent : 17}%` }}
              className="bg-indigo-500 transition-all"
              title="Revision"
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-[10px] font-bold text-slate px-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Theory (
              {stats.todayMinutes > 0 ? `${stats.theoryMins}m` : "0m"})
            </span>
            <span className="flex items-center gap-1 text-teal">
              <span className="w-2 h-2 rounded-full bg-teal" /> Practice (
              {stats.todayMinutes > 0 ? `${stats.practiceMins}m` : "0m"})
            </span>
            <span className="flex items-center gap-1 text-indigo-600">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Revision (
              {stats.todayMinutes > 0 ? `${stats.revisionMins}m` : "0m"})
            </span>
          </div>
        </div>

        {/* 6. WEEKLY STUDY CONSISTENCY MATRIX (7-Day Heatmap) */}
        <div className="bg-white p-3.5 rounded-2xl border border-ink/8 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-ink flex items-center gap-1.5">
              <span>📅</span> 7-Day Consistency Matrix
            </span>
            <span className="text-[10px] font-bold text-slate">Avg 6h/day target</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => {
              const hrs = weeklyLogs[idx] || 0;
              const isHigh = hrs >= 6;
              const isMed = hrs >= 3 && hrs < 6;
              const isZero = hrs === 0;

              return (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-full aspect-square rounded-xl flex items-center justify-center text-[10px] font-black transition-all ${
                      isHigh
                        ? "bg-teal text-white shadow-2xs"
                        : isMed
                        ? "bg-teal/30 text-teal-900 border border-teal/30"
                        : isZero
                        ? "bg-slate-100 text-slate-400"
                        : "bg-teal/15 text-teal"
                    }`}
                  >
                    {hrs > 0 ? `${hrs}h` : "·"}
                  </div>
                  <span className="text-[9.5px] font-bold text-slate">{day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. BACKLOG RADAR (Pending DPPs & Homework) */}
        <div className="bg-white p-3.5 rounded-2xl border border-ink/8 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-ink flex items-center gap-1.5">
              <span>🎯</span> High-Yield Backlog Radar
            </span>
            <button
              type="button"
              onClick={() => setShowAddBacklog(!showAddBacklog)}
              className="text-[10.5px] font-bold text-teal hover:underline"
            >
              {showAddBacklog ? "Cancel" : "+ Add Backlog"}
            </button>
          </div>

          {/* Quick Add Input Field */}
          {showAddBacklog && (
            <form onSubmit={handleAddBacklog} className="flex gap-1.5 mb-2.5 animate-in fade-in">
              <input
                type="text"
                value={newBacklogTitle}
                onChange={(e) => setNewBacklogTitle(e.target.value)}
                placeholder="e.g. Rotational Motion DPP #3"
                className="flex-1 text-xs p-2 rounded-xl border border-ink/15 focus:outline-none focus:border-teal"
              />
              <button
                type="submit"
                disabled={!newBacklogTitle.trim()}
                className="px-3 py-2 bg-ink text-paper text-xs font-bold rounded-xl disabled:opacity-40"
              >
                Save
              </button>
            </form>
          )}

          {backlogs.length === 0 ? (
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-800 font-bold">
              🎉 Zero backlogs! All homework & DPPs are up to date.
            </div>
          ) : (
            <div className="space-y-1.5">
              {backlogs.map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 bg-paper/50 border border-ink/8 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                    <span className="font-semibold text-ink truncate">{b.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCompleteBacklog(b.id)}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 active:scale-95 flex-shrink-0"
                  >
                    Done ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 8. LATEST TEST BENCHMARK STRIP */}
        <div className="bg-white p-3.5 rounded-2xl border border-ink/8 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-ink flex items-center gap-1.5">
              <span>📊</span> Recent Mock Performance
            </span>
            <button
              type="button"
              onClick={() => router.push("/test")}
              className="text-[10.5px] font-bold text-indigo-600 hover:underline"
            >
              Test Hub →
            </button>
          </div>

          {latestTests.length === 0 ? (
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black text-indigo-950">No Mocks Recorded Yet</div>
                <div className="text-[10px] text-slate">Log your first test to unlock percentiles</div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/test")}
                className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[10.5px] rounded-lg shadow-2xs"
              >
                + Log Test
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {latestTests.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 bg-paper/60 border border-ink/8 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-ink text-[11px]">{t.test_name}</div>
                    <div className="text-[10px] text-slate">{t.test_date}</div>
                  </div>
            
