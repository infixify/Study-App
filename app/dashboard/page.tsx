// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/BottomNav";
import AiMentorCard from "@/components/dashboard/AiMentorCard";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

interface TestLog {
  id: string;
  test_name: string;
  total_marks: number;
  max_marks: number;
  accuracy: number;
  test_date: string;
}

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  task_type?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // AI Mentor & Doubt state
  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  // Telemetry Metrics
  const [todayFocusMins, setTodayFocusMins] = useState(0);
  const [todayQuestions, setTodayQuestions] = useState(0);
  const [streak, setStreak] = useState(0);
  const [backlogCount, setBacklogCount] = useState(0);

  // Study Distribution (Theory vs Practice vs Revision)
  const [splitRatio, setSplitRatio] = useState({
    theory: 0,
    practice: 0,
    revision: 0,
  });

  // Today's Priority Tasks & Recent Tests
  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([]);
  const [recentTests, setRecentTests] = useState<TestLog[]>([]);

  // 12-Week Heatmap matrix (84 days)
  const [heatGrid, setHeatGrid] = useState<number[]>([]);
  const [totalQuestionsAllTime, setTotalQuestionsAllTime] = useState(0);

  // Dynamic Exam Countdown
  const [daysLeft, setDaysLeft] = useState(0);
  const [examLabel, setExamLabel] = useState("");

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

      // 1. Fetch User Profile
      const { data: uProf } = await supabase
        .from("users")
        .select("*")
        .eq("uid", session.user.id)
        .maybeSingle();

      const studentTargetExam = uProf?.target_exam || "JEE";
      const studentTargetYear = uProf?.target_year || "2027";

      if (uProf) {
        setProfile(uProf);
        fetchMentorReport(session.user.id);
      }

      // Dynamic Countdown based on student's actual target
      let targetDateStr = `${studentTargetYear}-01-22T09:00:00`;
      let label = `${studentTargetExam} ${studentTargetYear}`;

      if (studentTargetExam.toUpperCase() === "NEET") {
        targetDateStr = `${studentTargetYear}-05-04T14:00:00`;
        label = `NEET ${studentTargetYear}`;
      } else if (uProf?.wants_boards) {
        label = `${studentTargetExam} & Boards ${studentTargetYear}`;
      }

      const diff = new Date(targetDateStr).getTime() - new Date().getTime();
      const remaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      setDaysLeft(remaining);
      setExamLabel(label);

      const todayStr = new Date().toISOString().split("T")[0];

      // 2. Fetch Daily Logs & Streak & Study Split
      const { data: pastLogs } = await supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, streak_count, log_date")
        .eq("user_id", session.user.id)
        .order("log_date", { ascending: false })
        .limit(84);

      const todayLog = pastLogs?.find((l) => l.log_date === todayStr);
      setTodayFocusMins(todayLog?.study_time_minutes || 0);
      setStreak(todayLog?.streak_count || pastLogs?.[0]?.streak_count || 0);

      setSplitRatio({
        theory: todayLog?.theory_minutes || 0,
        practice: todayLog?.practice_minutes || 0,
        revision: todayLog?.revision_minutes || 0,
      });

      // 3. Fetch Questions Solved
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

      // Build 12-week (84-day) heatmap grid
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

      // 4. Fetch Backlogs & Tasks from tasks + chapter_progress
      const [{ data: chBacklogs }, { data: userTasks }] = await Promise.all([
        supabase
          .from("chapter_progress")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("is_backlog", true),
        supabase
          .from("tasks")
          .select("id, title, priority, status, task_type")
          .eq("user_id", session.user.id)
          .neq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      const pendingBacklogTasks = (userTasks || []).filter((t) => t.task_type === "backlog").length;
      setBacklogCount((chBacklogs?.length || 0) + pendingBacklogTasks);
      setTodayTasks(userTasks || []);

      // 5. Fetch Recent Tests
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

  // Quick Task Check-off directly from dashboard
  const handleToggleTask = async (taskId: string) => {
    setTodayTasks((prev) => prev.filter((t) => t.id !== taskId));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", taskId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-500">
        <span className="animate-spin mr-2">⏳</span> Loading PrepWise Dashboard…
      </div>
    );
  }

  const studentName = profile?.name || user?.user_metadata?.full_name?.split(" ")[0] || "Aspirant";
  const targetExam = profile?.target_exam || "JEE";
  const todayHours = (todayFocusMins / 60).toFixed(1);

  // Ratio split percentages
  const sumSplit = splitRatio.theory + splitRatio.practice + splitRatio.revision;
  const totalSplitMins = sumSplit > 0 ? sumSplit : 1;
  const theoryPct = Math.round((splitRatio.theory / totalSplitMins) * 100);
  const practicePct = Math.round((splitRatio.practice / totalSplitMins) * 100);
  const revisionPct = Math.round((splitRatio.revision / totalSplitMins) * 100);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-28 text-slate-900">
      {/* 1. TOP HEADER */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-2.5">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
              PW
            </span>
            <div>
              <h1 className="text-xs font-black tracking-tight text-slate-900 leading-none">PrepWise</h1>
              <span className="text-[10px] font-bold text-slate-500">{examLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Streak Counter */}
            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-xl text-amber-800 text-[11px] font-black">
              <span>🔥</span>
              <span>{streak}d</span>
            </div>

            {/* Profile Avatar */}
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-2xs hover:opacity-90 transition-all"
            >
              {studentName.charAt(0).toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-md mx-auto px-4 pt-3.5 space-y-3.5">
        {/* 2. EXAM COUNTDOWN HERO */}
        <div className="rounded-2xl p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md relative overflow-hidden flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
              {examLabel}
            </div>
            <div className="text-xs font-semibold text-slate-200 mt-0.5">
              Consistent daily practice builds rank
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

        {/* 3. COMPACT AI MENTOR WIDGET */}
        <AiMentorCard
          userId={user?.id}
          targetExam={targetExam}
          report={mentorReport}
          loading={mentorLoading}
          onRefresh={() => fetchMentorReport(user?.id, true)}
          onOpenDoubtSolver={() => setDoubtOpen(true)}
        />

        {/* 4. THREE COCKPIT METRICS */}
        <div className="grid grid-cols-3 gap-2">
          {/* Today's Focus (Redirects to /focus) */}
          <button
            type="button"
            onClick={() => router.push("/focus")}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs text-left active:scale-[0.98] transition-all hover:border-teal-500"
          >
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Today Focus</span>
            <div className="text-base font-black text-slate-900">
              {todayHours}
              <span className="text-[10px] font-semibold text-slate-500">h</span>
            </div>
            <span className="text-[9.5px] font-bold text-teal-600 block mt-0.5">Start Timer →</span>
          </button>

          {/* Today Questions */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Questions</span>
            <div className="text-base font-black text-slate-900">{todayQuestions}</div>
            <span className="text-[9.5px] font-bold text-indigo-600 block mt-0.5">
              Total: {totalQuestionsAllTime}
            </span>
          </div>

          {/* Backlog Radar (Redirects to /library) */}
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs text-left active:scale-[0.98] transition-all hover:border-rose-400"
          >
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Backlogs</span>
            <div className="text-base font-black text-slate-900">{backlogCount}</div>
            <span
              className={`text-[9.5px] font-bold block mt-0.5 ${
                backlogCount > 0 ? "text-rose-500" : "text-emerald-600"
              }`}
            >
              {backlogCount > 0 ? "Clear in Syllabus →" : "Clean Slate ✓"}
            </span>
          </button>
        </div>

        {/* 5. STUDY RATIO SPLIT (Lecture vs Practice vs Revision) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-slate-900 flex items-center gap-1.5">
              <span>⚖️</span> Today's Study Split
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Target: 60% Numerical Practice
            </span>
          </div>

          {/* Ratio bar */}
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex mb-2">
            <div
              style={{ width: `${sumSplit > 0 ? theoryPct : 33}%` }}
              className="bg-amber-400 transition-all"
            />
            <div
              style={{ width: `${sumSplit > 0 ? practicePct : 50}%` }}
              className="bg-teal-600 transition-all"
            />
            <div
              style={{ width: `${sumSplit > 0 ? revisionPct : 17}%` }}
              className="bg-indigo-500 transition-all"
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 px-0.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Theory ({splitRatio.theory}m)
            </span>
            <span className="flex items-center gap-1 text-teal-600">
              <span className="w-2 h-2 rounded-full bg-teal-600" /> Practice ({splitRatio.practice}m)
            </span>
            <span className="flex items-center gap-1 text-indigo-600">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Revision ({splitRatio.revision}m)
            </span>
          </div>
        </div>

        {/* 6. GITHUB-STYLE 12-WEEK CONSISTENCY HEATMAP */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 flex items-center gap-1.5">
              <span>🟩</span> 12-Week Consistency Matrix
            </span>
            <span className="text-[10px] font-bold text-slate-500">{streak} Day Streak</span>
          </div>

          {/* Heatmap Grid (7 rows x 12 cols = 84 cells) */}
          <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto py-1">
            {heatGrid.map((level, idx) => {
              const bg =
                level === 4
                  ? "bg-teal-700"
                  : level === 3
                  ? "bg-teal-500"
                  : level === 2
                  ? "bg-teal-300"
                  : level === 1
                  ? "bg-teal-100"
                  : "bg-slate-100";
              return <div key={idx} className={`w-3.5 h-3.5 rounded-xs ${bg}`} />;
            })}
          </div>

          <div className="flex items-center justify-between text-[9.5px] font-bold text-slate-400 mt-2 px-0.5">
            <span>Less Focus</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-100" />
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-100" />
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-300" />
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-500" />
              <span className="w-2.5 h-2.5 rounded-xs bg-teal-700" />
            </div>
            <span>More Focus (6h+)</span>
          </div>
        </div>

        {/* 7. PRIORITY TO-DO & ACTION LIST (Live 1-Tap Toggle) */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-slate-900 flex items-center gap-1.5">
              <span>🎯</span> Today's Action Items
            </span>
            <button
              type="button"
              onClick={() => router.push("/todo")}
              className="text-[10.5px] font-bold text-teal-600 hover:underline"
            >
              Manage All →
            </button>
          </div>

          {todayTasks.length === 0 ? (
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-800 font-bold">
              🎉 No pending tasks! Add goals in your To-Do list.
            </div>
          ) : (
            <div className="space-y-1.5">
              {todayTasks.map((task) => {
                const isHigh = task.priority === "high";
                const isMed = task.priority === "medium";

                return (
                  <div
                    key={task.id}
                    className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isHigh ? "bg-rose-500" : isMed ? "bg-amber-400" : "bg-emerald-500"
                        }`}
                      />
                      <span className="font-semibold text-slate-800 truncate">{task.title}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleTask(task.id)}
                      className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md hover:bg-emerald-100 active:scale-95 flex-shrink-0"
                    >
                      Done ✓
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 8. QUICK ROUTE CARDS */}
        <div className="grid grid-cols-2 gap-2">
          {/* Syllabus & Chapter Tracker */}
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl text-left shadow-2xs active:scale-[0.98] transition-all"
          >
            <div className="text-base mb-1">📚</div>
            <div className="text-xs font-black text-slate-900">Syllabus Tracker</div>
            <div className="text-[10px] text-slate-500">Chapters & Backlogs</div>
          </button>

          {/* Test Performance */}
          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl text-left shadow-2xs active:scale-[0.98] transition-all"
          >
            <div className="text-base mb-1">📊</div>
            <div className="text-xs font-black text-slate-900">Test Hub</div>
            <div className="text-[10px] text-slate-500">Log & analyze marks</div>
          </button>
        </div>

        {/* 9. RECENT MOCK TESTS */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-slate-900 flex items-center gap-1.5">
              <span>📈</span> Recent Mock Performance
            </span>
            <button
              type="button"
              onClick={() => router.push("/tests")}
              className="text-[10.5px] font-bold text-indigo-600 hover:underline"
            >
              View Hub →
            </button>
          </div>

          {recentTests.length === 0 ? (
            <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black text-indigo-950">No Tests Logged</div>
                <div className="text-[10px] text-slate-500">Log mock test marks to track accuracy</div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/tests")}
                className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[10.5px] rounded-lg shadow-2xs"
              >
                + Log Score
                </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentTests.map((t) => (
                <div
                  key={t.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-900 text-[11px]">{t.test_name}</div>
                    <div className="text-[10px] text-slate-500">{t.test_date}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-slate-900 text-xs">
                      {t.total_marks} / {t.max_marks}
                    </div>
                    <div className="text-[10px] font-bold text-teal-600">
                      Acc: {t.accuracy || Math.round((t.total_marks / t.max_marks) * 100)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* AI Doubt Solver Sheet */}
      <AiChatSheet open={doubtOpen} onClose={() => setDoubtOpen(false)} />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
