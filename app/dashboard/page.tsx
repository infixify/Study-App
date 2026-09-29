// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/dashboard/BottomNav";
import AppHeader from "@/components/dashboard/AppHeader";
import AiMentorCard from "@/components/dashboard/AiMentorCard";
import AiChatSheet from "@/components/dashboard/AiChatSheet";

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
}

interface TestLog {
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

  // AI Mentor & Doubt state
  const [mentorReport, setMentorReport] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [doubtOpen, setDoubtOpen] = useState(false);

  // Telemetry metrics
  const [todayFocusMins, setTodayFocusMins] = useState(0);
  const [todayQuestions, setTodayQuestions] = useState(0);
  const [totalQuestionsAllTime, setTotalQuestionsAllTime] = useState(0);
  const [streak, setStreak] = useState(0);

  // Backlogs
  const [backlogsList, setBacklogsList] = useState<TaskItem[]>([]);
  const [showAddBacklog, setShowAddBacklog] = useState(false);
  const [newBacklogTitle, setNewBacklogTitle] = useState("");
  const [addingBacklog, setAddingBacklog] = useState(false);

  // Study Distribution (Theory vs Practice vs Revision)
  const [splitRatio, setSplitRatio] = useState({
    theory: 0,
    practice: 0,
    revision: 0,
  });

  // Action tasks & mock logs
  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([]);
  const [recentTests, setRecentTests] = useState<TestLog[]>([]);
  const [heatGrid, setHeatGrid] = useState<number[]>([]);

  // Personalized Exam Schedules & Shifts from DB
  const [examSchedules, setExamSchedules] = useState<ExamScheduleItem[]>([]);
  const [shiftsMap, setShiftsMap] = useState<Record<string, ExamShift[]>>({});
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);

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

      if (uProf) {
        setProfile(uProf);
        setSelectedShiftId(uProf.selected_shift_id || null);
        fetchMentorReport(session.user.id);
      }

      const targetExam = uProf?.target_exam || "JEE";
      const targetYear = Number(uProf?.target_year) || 2027;

      // 2. Fetch Personalized Exam Schedules from DB
      const { data: schedules } = await supabase
        .from("exam_schedule")
        .select("*")
        .or(`target_exam.eq.${targetExam},target_exam.eq.ALL`)
        .eq("year", targetYear)
        .order("display_order", { ascending: true });

      if (schedules && schedules.length > 0) {
        setExamSchedules(schedules);

        const scheduleIds = schedules.map((s) => s.id);
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
      } else {
        const fallbackList: ExamScheduleItem[] = [];
        if (targetExam === "JEE") {
          fallbackList.push({
            id: "mains-fallback",
            exam_key: "jee_mains",
            label: "JEE Main (Session 1)",
            target_exam: "JEE",
            year: targetYear,
            exam_date: `${targetYear}-01-22T09:00:00`,
            is_confirmed: false,
          });
          fallbackList.push({
            id: "adv-fallback",
            exam_key: "jee_advanced",
            label: "JEE Advanced",
            target_exam: "JEE",
            year: targetYear,
            exam_date: `${targetYear}-05-24T09:00:00`,
            is_confirmed: false,
          });
        } else if (targetExam === "NEET") {
          fallbackList.push({
            id: "neet-fallback",
            exam_key: "neet_ug",
            label: "NEET UG",
            target_exam: "NEET",
            year: targetYear,
            exam_date: `${targetYear}-05-03T14:00:00`,
            is_confirmed: false,
          });
        }
        if (uProf?.wants_boards) {
          fallbackList.push({
            id: "boards-fallback",
            exam_key: "board_exam",
            label: `${uProf?.class_level || "12th"} Board Examination`,
            target_exam: "Boards",
            year: targetYear,
            exam_date: `${targetYear}-02-15T10:30:00`,
            is_confirmed: false,
          });
        }
        setExamSchedules(fallbackList);
      }

      const todayStr = new Date().toISOString().split("T")[0];

      // 3. Fetch Daily Logs & Streak & Study Split
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

      // 4. Questions Solved
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

      // Build 84-day heatmap grid
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

      // 5. Backlogs & Action Tasks
      const { data: userTasks } = await supabase
        .from("tasks")
        .select("id, title, priority, status, task_type")
        .eq("user_id", session.user.id)
        .neq("status", "completed")
        .order("created_at", { ascending: false });

      if (userTasks) {
        const bl = userTasks.filter((t) => t.task_type === "backlog");
        const regularTasks = userTasks.filter((t) => t.task_type !== "backlog");
        setBacklogsList(bl);
        setTodayTasks(regularTasks.slice(0, 4));
      }

      // 6. Recent Mock Tests
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

  // JEETrack-Style Add Backlog directly from dashboard
  const handleAddBacklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBacklogTitle.trim() || !user || addingBacklog) return;

    setAddingBacklog(true);
    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: newBacklogTitle.trim(),
          task_type: "backlog",
          priority: "high",
          status: "pending",
        })
        .select()
        .single();

      if (!error && data) {
        setBacklogsList((prev) => [data, ...prev]);
        setNewBacklogTitle("");
        setShowAddBacklog(false);
      }
    } catch (err) {
      console.error("Failed to add backlog:", err);
    } finally {
      setAddingBacklog(false);
    }
  };

  const handleCompleteBacklog = async (id: string) => {
    setBacklogsList((prev) => prev.filter((b) => b.id !== id));
    await supabase.from("tasks").update({ status: "completed" }).eq("id", id);
  };

  const calculateDaysLeft = (targetDate: string) => {
    const diff = new Date(targetDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-600">
        <span className="animate-spin mr-2">⏳</span> Loading PrepWise Dashboard…
      </div>
    );
  }

  const targetExam = profile?.target_exam || "JEE";
  const todayHours = (todayFocusMins / 60).toFixed(1);

  const sumSplit = splitRatio.theory + splitRatio.practice + splitRatio.revision;
  const totalSplitMins = sumSplit > 0 ? sumSplit : 1;
  const theoryPct = Math.round((splitRatio.theory / totalSplitMins) * 100);
  const practicePct = Math.round((splitRatio.practice / totalSplitMins) * 100);
  const revisionPct = Math.round((splitRatio.revision / totalSplitMins) * 100);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-slate-900 font-sans">
      {/* 1. ORIGINAL GLOBAL APPHEADER (Zero Props Required) */}
      <AppHeader />

      {/* MAIN CONTAINER */}
      <main className="max-w-md mx-auto px-4 pt-3 space-y-3.5">
        {/* 2. PERSONALIZED EXAM COUNTDOWN SUITE */}
        <div className="space-y-2">
          {examSchedules.map((exam) => {
            const days = calculateDaysLeft(exam.exam_date);
            const shifts = shiftsMap[exam.id] || [];

            return (
              <div
                key={exam.id}
                className="rounded-2xl p-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white shadow-md border border-slate-800"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                        {exam.label}
                      </span>
                      <span className="text-[9.5px] text-slate-400">
                        {exam.is_confirmed ? "Official" : "Estimated"}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-200 mt-1">
                      {new Date(exam.exam_date).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>

                  <div className="text-right bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-xs">
                    <div className="text-xl font-black tracking-tight text-white leading-none">
                      {days}
                    </div>
                    <div className="text-[8.5px] font-bold uppercase tracking-wider text-slate-300">
                      Days Left
                    </div>
                  </div>
                </div>

                {/* Shift Selector */}
                {shifts.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-semibold">Your Shift:</span>
                    <select
                      value={selectedShiftId || ""}
                      onChange={(e) => handleShiftSelect(e.target.value)}
                      className="bg-slate-800 text-white rounded-lg px-2 py-1 border border-slate-700 text-[10px] focus:outline-none"
                    >
                      <option value="">Select Exam Shift</option>
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
          {/* Today Focus -> /focus */}
          <button
            type="button"
            onClick={() => router.push("/focus")}
            className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs text-left active:scale-[0.98] transition-all hover:border-teal-500"
          >
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Today Focus</span>
            <div className="text-base font-black text-slate-900">
              {todayHours}
              <span className="text-[10px] font-semibold text-slate-500">h</span>
            </div>
            <span className="text-[9.5px] font-bold text-teal-600 block mt-0.5">Timer →</span>
          </button>

          {/* Today Questions */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Questions</span>
            <div className="text-base font-black text-slate-900">{todayQuestions}</div>
            <span className="text-[9.5px] font-bold text-indigo-600 block mt-0.5">
              All: {totalQuestionsAllTime}
            </span>
          </div>

          {/* Backlogs Count */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Backlogs</span>
            <div className="text-base font-black text-slate-900">{backlogsList.length}</div>
            <span
              className={`text-[9.5px] font-bold block mt-0.5 ${
                backlogsList.length > 0 ? "text-rose-500" : "text-emerald-600"
              }`}
            >
              {backlogsList.length > 0 ? "Pending" : "Clean ✓"}
            </span>
          </div>
        </div>

        {/* 5. JEETRACK-GRADE BACKLOG RADAR & MINI ADDER WIDGET */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <div className="flex items-center gap-1.5 text-slate-900">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Backlog Radar</span>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                {backlogsList.length} Pending
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddBacklog(!showAddBacklog)}
              className="text-[10.5px] font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100/70 border border-teal-200 px-2 py-0.5 rounded-lg transition-all"
            >
              {showAddBacklog ? "✕ Close" : "+ Add Backlog"}
            </button>
          </div>

          {/* Quick-Add Backlog Drawer */}
          {showAddBacklog && (
            <form onSubmit={handleAddBacklog} className="mb-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200 animate-in fade-in">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBacklogTitle}
                  onChange={(e) => setNewBacklogTitle(e.target.value)}
                  placeholder="e.g. Rotational Motion DPP #2 or Chemical Bonding PYQ"
                  className="flex-1 text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-teal-600"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!newBacklogTitle.trim() || addingBacklog}
                  className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg disabled:opacity-40 active:scale-95 transition-all shadow-xs"
                >
                  {addingBacklog ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          )}

          {/* Backlogs List */}
          {backlogsList.length === 0 ? (
            <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl text-center text-xs text-emerald-800 font-semibold">
              🎉 Zero backlogs! All homework, DPPs & syllabus chapters are on schedule.
            </div>
          ) : (
            <div className="space-y-1.5">
              {backlogsList.slice(0, 5).map((b) => (
                <div
                  key={b.id}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">{b.title}</span>
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
              {backlogsList.length > 5 && (
                <button
                  type="button"
                  onClick={() => router.push("/library")}
                  className="w-full text-center text-[10.5px] font-bold text-slate-500 hover:text-slate-800 pt-1 block"
                >
                  View all in Syllabus Tracker →
                </button>
              )}
            </div>
          )}
        </div>

        {/* 6. STUDY DISTRIBUTION RATIO BAR */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black mb-2">
            <span className="text-slate-900 flex items-center gap-1.5">
              <span>⚖️</span> Today's Study Split
            </span>
            <span className="text-[10px] font-bold text-slate-500">
              Target: 60% Numerical Practice
            </span>
          </div>

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

          <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 px-0.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Theory ({splitRatio.theory}m)
            </span>
            <span className="flex items-center gap-1 text-teal-700">
              <span className="w-2 h-2 rounded-full bg-teal-600" /> Practice ({splitRatio.practice}m)
            </span>
            <span className="flex items-center gap-1 text-indigo-700">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Revision ({splitRatio.revision}m)
            </span>
          </div>
        </div>

        {/* 7. 12-WEEK CONSISTENCY MATRIX */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-black mb-2.5">
            <span className="text-slate-900 flex items-center gap-1.5">
              <span>🟩</span> 12-Week Consistency Matrix
            </span>
            <span className="text-[10px] font-bold text-slate-500">{streak} Day Streak</span>
          </div>

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

        {/* 8. PRIORITY ACTION ITEMS */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
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
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-center text-xs text-emerald-800 font-bold">
              🎉 No pending tasks! Plan goals in your To-Do tab.
            </div>
          ) : (
            <div className="space-y-1.5">
              {todayTasks.map((task) => {
                const isHigh = task.priority === "high";
                const isMed = task.priority === "medium";

                return (
                  <div
                    key={task.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
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

        {/* 9. QUICK ROUTE CARDS */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => router.push("/library")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left shadow-xs active:scale-[0.98] transition-all"
          >
            <div className="text-base mb-1">📚</div>
            <div className="text-xs font-black text-slate-900">Syllabus Tracker</div>
            <div className="text-[10px] text-slate-500">Chapters & Backlogs</div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/tests")}
            className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-left shadow-xs active:scale-[0.98] transition-all"
          >
            <div className="text-base mb-1">📊</div>
            <div className="text-xs font-black text-slate-900">Test Hub</div>
            <div className="text-[10px] text-slate-500">Log & analyze marks</div>
          </button>
        </div>

        {/* 10. RECENT MOCK TESTS */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
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
