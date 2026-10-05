// app/tests/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import AppHeader from "@/components/dashboard/AppHeader";
import BottomNav from "@/components/dashboard/BottomNav";

type Scope = "chapter" | "subject" | "full_syllabus";
type View = "log" | "schedule";

type SubjectOption = {
  key: string;
  name: string;
  sources: { id: string; classLevel: string }[];
};

type ChapterOption = { id: string; title: string; classLevel: string };

type TestLogRow = {
  id: string;
  scope: Scope;
  test_name: string;
  total_questions: number;
  correct_count: number;
  wrong_count: number;
  unattempted_count: number;
  marks_scored: number | null;
  max_marks: number | null;
  physics_marks?: number;
  chemistry_marks?: number;
  maths_marks?: number;
  accuracy: number | null;
  test_date: string;
  subject_id: string | null;
  chapter_id: string | null;
};

type ScheduleRow = {
  id: string;
  title: string;
  scope: Scope;
  subject_id: string | null;
  chapter_id: string | null;
  scheduled_date: string;
  is_done: boolean;
};

export default function TestsPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("log");
  const [targetExam, setTargetExam] = useState<string | null>(null);
  const [isPureDropper, setIsPureDropper] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [logs, setLogs] = useState<TestLogRow[]>([]);
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- log-a-test form state ---
  const [scope, setScope] = useState<Scope>("full_syllabus");
  const [subjectKey, setSubjectKey] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [testName, setTestName] = useState("");
  const [correct, setCorrect] = useState("");
  const [wrong, setWrong] = useState("");
  const [unattempted, setUnattempted] = useState("");
  const [marksScored, setMarksScored] = useState("");
  const [maxMarks, setMaxMarks] = useState("300");
  const [pMarks, setPMarks] = useState("");
  const [cMarks, setCMarks] = useState("");
  const [mMarks, setMMarks] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));

  // --- schedule form state ---
  const [schedTitle, setSchedTitle] = useState("");
  const [schedScope, setSchedScope] = useState<Scope>("full_syllabus");
  const [schedSubjectKey, setSchedSubjectKey] = useState("");
  const [schedChapterId, setSchedChapterId] = useState("");
  const [schedDate, setSchedDate] = useState(
    new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from("users")
        .select("target_exam, class_level")
        .eq("uid", user.id)
        .maybeSingle();

      const userTargetExam = userProfile?.target_exam ?? "JEE";
      setTargetExam(userTargetExam);
      const pureDropper = userProfile?.class_level === "Dropper";
      setIsPureDropper(pureDropper);

      let query = supabase
        .from("subjects")
        .select("id, name, class_level, display_order")
        .order("display_order", { ascending: true });

      if (userTargetExam) {
        query = query.eq("target_exam", userTargetExam);
      }

      const { data: subjectRows } = await query;

      if (subjectRows) {
        const grouped = new Map<string, SubjectOption>();
        for (const s of subjectRows) {
          const key = s.name.trim().toLowerCase();
          if (!grouped.has(key)) {
            grouped.set(key, { key, name: s.name, sources: [] });
          }
          grouped.get(key)!.sources.push({ id: s.id, classLevel: s.class_level });
        }
        setSubjects(Array.from(grouped.values()));
      }

      const { data: testLogs } = await supabase
        .from("tests")
        .select(
          "id, scope, test_name, total_questions, correct_count, wrong_count, unattempted_count, marks_scored, max_marks, physics_marks, chemistry_marks, maths_marks, accuracy, test_date, subject_id, chapter_id"
        )
        .eq("user_id", user.id)
        .order("test_date", { ascending: false });

      if (testLogs) setLogs(testLogs as TestLogRow[]);

      const { data: schedules } = await supabase
        .from("test_schedules")
        .select("id, title, scope, subject_id, chapter_id, scheduled_date, is_done")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: true });

      if (schedules) setScheduleRows(schedules as ScheduleRow[]);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load tests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load chapters when subjectKey changes
  useEffect(() => {
    if (!subjectKey) {
      setChapters([]);
      setChapterId("");
      return;
    }
    const subj = subjects.find((s) => s.key === subjectKey);
    if (!subj) return;

    const ids = subj.sources.map((src) => src.id);
    const idToClass = new Map(subj.sources.map((src) => [src.id, src.classLevel]));

    async function fetchChapters() {
      const { data } = await supabase
        .from("chapters")
        .select("id, title, subject_id, display_order")
        .in("subject_id", ids)
        .order("display_order", { ascending: true });

      if (data) {
        setChapters(
          data.map((c) => ({
            id: c.id,
            title: isPureDropper
              ? `${idToClass.get(c.subject_id) === "11" ? "XI" : "XII"} — ${c.title}`
              : c.title,
            classLevel: idToClass.get(c.subject_id) ?? "",
          }))
        );
      }
    }
    fetchChapters();
  }, [subjectKey, subjects, isPureDropper]);

  // Load chapters when schedSubjectKey changes
  useEffect(() => {
    if (!schedSubjectKey) {
      return;
    }
    const subj = subjects.find((s) => s.key === schedSubjectKey);
    if (!subj) return;

    const ids = subj.sources.map((src) => src.id);
    const idToClass = new Map(subj.sources.map((src) => [src.id, src.classLevel]));

    async function fetchSchedChapters() {
      const { data } = await supabase
        .from("chapters")
        .select("id, title, subject_id, display_order")
        .in("subject_id", ids)
        .order("display_order", { ascending: true });

      if (data) {
        setChapters(
          data.map((c) => ({
            id: c.id,
            title: isPureDropper
              ? `${idToClass.get(c.subject_id) === "11" ? "XI" : "XII"} — ${c.title}`
              : c.title,
            classLevel: idToClass.get(c.subject_id) ?? "",
          }))
        );
      }
    }
    fetchSchedChapters();
  }, [schedSubjectKey, subjects, isPureDropper]);

  // Log test submit
  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to record a test score.");

      const c = Number(correct) || 0;
      const w = Number(wrong) || 0;
      const u = Number(unattempted) || 0;
      const totalQ = c + w + u;
      const accuracy = totalQ > 0 ? Math.round((c / (c + w)) * 100) || 0 : null;

      const chosenSubj = subjects.find((s) => s.key === subjectKey);
      let representativeSubjectId = null;
      if (chosenSubj && chosenSubj.sources.length > 0) {
        representativeSubjectId = chosenSubj.sources[0].id;
      }

      const payload = {
        user_id: user.id,
        test_name: testName.trim() || "Untitled Mock",
        scope,
        subject_id:
          scope === "chapter" || scope === "subject" ? representativeSubjectId : null,
        chapter_id: scope === "chapter" && chapterId ? chapterId : null,
        total_questions: totalQ,
        correct_count: c,
        wrong_count: w,
        unattempted_count: u,
        marks_scored: marksScored !== "" ? Number(marksScored) : null,
        max_marks: maxMarks !== "" ? Number(maxMarks) : null,
        physics_marks: pMarks ? Number(pMarks) : null,
        chemistry_marks: cMarks ? Number(cMarks) : null,
        maths_marks: mMarks ? Number(mMarks) : null,
        accuracy,
        test_date: testDate,
      };

      const { error: insertError } = await supabase.from("tests").insert(payload);
      if (insertError) throw insertError;

      // Reset
      setTestName("");
      setCorrect("");
      setWrong("");
      setUnattempted("");
      setMarksScored("");
      setPMarks("");
      setCMarks("");
      setMMarks("");
      loadData();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save test score.");
    } finally {
      setSaving(false);
    }
  };

  // Schedule submit
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Please log in to schedule a test.");

      const chosenSubj = subjects.find((s) => s.key === schedSubjectKey);
      let representativeSubjectId = null;
      if (chosenSubj && chosenSubj.sources.length > 0) {
        representativeSubjectId = chosenSubj.sources[0].id;
      }

      const payload = {
        user_id: user.id,
        title: schedTitle.trim() || "Scheduled Mock",
        scope: schedScope,
        subject_id:
          schedScope === "chapter" || schedScope === "subject"
            ? representativeSubjectId
            : null,
        chapter_id: schedScope === "chapter" && schedChapterId ? schedChapterId : null,
        scheduled_date: schedDate,
        is_done: false,
      };

      const { error: insertError } = await supabase
        .from("test_schedules")
        .insert(payload);
      if (insertError) throw insertError;

      setSchedTitle("");
      loadData();
    } catch (err: any) {
      setError(err?.message ?? "Failed to schedule test.");
    } finally {
      setSaving(false);
    }
  };

  // Toggle schedule is_done
  const toggleScheduleDone = async (id: string, current: boolean) => {
    try {
      await supabase
        .from("test_schedules")
        .update({ is_done: !current })
        .eq("id", id);
      setScheduleRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_done: !current } : r))
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Aggregates
  const totalScored = logs.reduce((acc, l) => acc + (l.marks_scored || 0), 0);
  const avgScore = logs.length > 0 ? Math.round(totalScored / logs.length) : 0;
  const avgAccuracy =
    logs.length > 0
      ? Math.round(
          logs.reduce((acc, l) => acc + (l.accuracy || 0), 0) / logs.length
        )
      : 0;

  const chronologicalLogs = [...logs].reverse();

  return (
    <div className="min-h-screen bg-paper pb-28">
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="font-display text-2xl text-ink">Mock Tests</h1>
            <p className="text-xs text-slate mt-0.5">
              Target: <span className="font-bold text-teal">{targetExam}</span> • Score Tracker
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/tests/analysis")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal/10 border border-teal/25 text-teal text-[11px] font-extrabold hover:bg-teal/20 transition-all shrink-0"
          >
            <span>📊</span>
            <span>View Analysis</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium mb-4">
            ⚠️ {error}
          </div>
        )}

        {/* 📈 JEETrack-Style Summary */}
        {logs.length > 0 && (
          <div className="rounded-ticket border border-ink/10 bg-white p-5 shadow-xs mb-5">
            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-ink/8 text-center">
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">
                  Tests Given
                </p>
                <p className="text-xl font-black text-ink mt-0.5">{logs.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">
                  Avg Score
                </p>
                <p className="text-xl font-black text-teal mt-0.5">{avgScore}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">
                  Avg Accuracy
                </p>
                <p className="text-xl font-black text-emerald-600 mt-0.5">
                  {avgAccuracy}%
                </p>
              </div>
            </div>

            {/* Score Trend Curve */}
            {chronologicalLogs.length > 1 && (
              <div className="pt-4">
                <div className="flex justify-between items-center text-[10px] text-slate font-bold uppercase mb-2">
                  <span>Score Progression Trend</span>
                  <span>Latest: {logs[0]?.marks_scored ?? "-"}</span>
                </div>
                <div className="flex items-end gap-2 h-24 pt-2">
                  {chronologicalLogs.slice(-8).map((t, idx) => {
                    const heightPct = Math.max(
                      12,
                      Math.round(
                        ((t.marks_scored || 0) / (t.max_marks || 300)) * 100
                      )
                    );
                    return (
                      <div
                        key={t.id || idx}
                        className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end"
                      >
                        <span className="text-[9px] font-bold text-ink font-mono">
                          {t.marks_scored ?? "-"}
                        </span>
                        <div className="w-full flex items-end justify-center h-16">
                          <div
                            className="w-full max-w-[20px] rounded-t-md bg-gradient-to-t from-teal to-emerald-400 transition-all shadow-xs"
                            style={{ height: `${heightPct}%` }}
                            title={`${t.test_name}: ${t.marks_scored}/${t.max_marks}`}
                          />
                        </div>
                        <span className="text-[8.5px] font-semibold text-slate truncate w-full text-center">
                          {new Date(t.test_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "narrow",
                          })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* View Switcher Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setView("log")}
            className={`flex-1 text-xs rounded-xl py-2.5 font-bold transition-all border ${
              view === "log"
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10 hover:text-ink"
            }`}
          >
            📊 Log Mock Scores
          </button>
          <button
            onClick={() => setView("schedule")}
            className={`flex-1 text-xs rounded-xl py-2.5 font-bold transition-all border ${
              view === "schedule"
                ? "bg-teal text-white border-teal shadow-xs"
                : "bg-white text-slate border-ink/10 hover:text-ink"
            }`}
          >
            📅 Schedule Tests
          </button>
        </div>

        {/* VIEW 1: LOG SCORES */}
        {view === "log" && (
          <>
            <div className="rounded-ticket border border-ink/10 bg-white p-5 mb-6 shadow-xs">
              <h3 className="text-sm font-bold text-ink mb-3">Record New Test Score</h3>

              {/* Scope Selector */}
              <div className="flex gap-1.5 mb-3.5">
                {(["full_syllabus", "subject", "chapter"] as Scope[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setScope(s);
                      if (s === "full_syllabus") {
                        setSubjectKey("");
                        setChapterId("");
                      }
                    }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      scope === s
                        ? "bg-ink text-paper border-ink"
                        : "bg-white text-slate border-ink/10 hover:text-ink"
                    }`}
                  >
                    {s === "full_syllabus"
                      ? "Full Mock"
                      : s === "subject"
                      ? "Subject Test"
                      : "Chapter Test"}
                  </button>
                ))}
              </div>

              {/* Subject Dropdown */}
              {(scope === "subject" || scope === "chapter") && (
                <select
                  value={subjectKey}
                  onChange={(e) => setSubjectKey(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-2.5 bg-white"
                >
                  <option value="">Select subject…</option>
                  {subjects.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Chapter Dropdown */}
              {scope === "chapter" && subjectKey && (
                <select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-2.5 bg-white"
                >
                  <option value="">Select chapter…</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              {/* 🎯 GUIDANCE PROMPT FOR CHAPTER SCOPE (Requested Addition) */}
              {scope === "chapter" && (
                <div className="p-3 bg-teal/10 border border-teal/20 rounded-xl flex items-center justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[11px] font-bold text-teal-900 leading-tight">
                      Chapter Micro Practice & Revision?
                    </p>
                    <p className="text-[10px] text-slate mt-0.5">
                      Log questions directly under chapter card in Syllabus.
                    </p>
                  </div>
                  <a
                    href="/library"
                    className="px-3 py-1.5 bg-teal text-white rounded-lg text-[10px] font-extrabold hover:bg-teal/90 transition-all shrink-0"
                  >
                    Go to Syllabus ➔
                  </a>
                </div>
              )}

              <input
                type="text"
                placeholder="Test name (e.g. Allen Major Test 04 / FIITJEE AITS)"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-3 bg-white focus:outline-none focus:border-teal"
              />

              {/* 🎯 SUBJECT BREAKDOWN ONLY FOR FULL SYLLABUS (Removed redundancy from Subject Test) */}
              {scope === "full_syllabus" && (
                <div className="p-3 rounded-xl bg-paper/60 border border-ink/8 mb-3">
                  <p className="text-[11px] font-bold text-ink mb-1.5">
                    Subject Marks (Optional Breakdown)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-[9.5px] font-bold text-slate block mb-0.5">
                        Physics
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={pMarks}
                        onChange={(e) => setPMarks(e.target.value)}
                        className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                      />
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold text-slate block mb-0.5">
                        Chemistry
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={cMarks}
                        onChange={(e) => setCMarks(e.target.value)}
                        className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                      />
                    </div>
                    <div>
                      <span className="text-[9.5px] font-bold text-slate block mb-0.5">
                        Maths / Bio
                      </span>
                      <input
                        type="number"
                        placeholder="0"
                        value={mMarks}
                        onChange={(e) => setMMarks(e.target.value)}
                        className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Question counts */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Correct (+)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={correct}
                    onChange={(e) => setCorrect(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold text-emerald-700 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Wrong (-)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={wrong}
                    onChange={(e) => setWrong(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold text-rose-700 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Skipped
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={unattempted}
                    onChange={(e) => setUnattempted(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold text-slate bg-white"
                  />
                </div>
              </div>

              {/* Overall Score & Date */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Total Marks Scored
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 185"
                    value={marksScored}
                    onChange={(e) => setMarksScored(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold bg-white text-ink"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">
                    Max Marks
                  </label>
                  <input
                    type="number"
                    placeholder="300"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold bg-white text-ink"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Test Date
                </label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 p-2 text-xs font-semibold bg-white"
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleLogSubmit}
                className="w-full py-3 bg-teal text-white rounded-xl text-xs font-bold shadow-md shadow-teal/20 hover:bg-teal/90 disabled:opacity-40 transition-all"
              >
                {saving ? "Saving…" : "Save Test Score"}
              </button>
            </div>

            {/* Test Log List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate uppercase tracking-wider">
                Recent Test History
              </h3>
              {logs.length === 0 ? (
                <p className="text-xs text-slate text-center py-6">
                  No mock test scores logged yet.
                </p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-ticket border border-ink/10 bg-white p-4 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-ink/5 text-ink/70">
                          {log.scope.replace("_", " ")}
                        </span>
                        <h4 className="text-xs font-bold text-ink mt-1">
                          {log.test_name}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-teal">
                          {log.marks_scored ?? "-"}
                        </span>
                        <span className="text-[10px] text-slate font-bold">
                          /{log.max_marks ?? 300}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-ink/5 text-[10px] text-slate font-semibold">
                      <span>Acc: {log.accuracy ?? 0}%</span>
                      <span>Correct: {log.correct_count}</span>
                      <span>Wrong: {log.wrong_count}</span>
                      <span className="ml-auto">
                        {new Date(log.test_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* VIEW 2: SCHEDULE TESTS */}
        {view === "schedule" && (
          <div className="space-y-5">
            <div className="rounded-ticket border border-ink/10 bg-white p-5 shadow-xs">
              <h3 className="text-sm font-bold text-ink mb-3">Plan an Upcoming Test</h3>

              <div className="flex gap-1.5 mb-3.5">
                {(["full_syllabus", "subject", "chapter"] as Scope[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSchedScope(s)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      schedScope === s
                        ? "bg-ink text-paper border-ink"
                        : "bg-white text-slate border-ink/10 hover:text-ink"
                    }`}
                  >
                    {s === "full_syllabus"
                      ? "Full"
                      : s === "subject"
                      ? "Subject"
                      : "Chapter"}
                  </button>
                ))}
              </div>

              {(schedScope === "subject" || schedScope === "chapter") && (
                <select
                  value={schedSubjectKey}
                  onChange={(e) => setSchedSubjectKey(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-2.5 bg-white"
                >
                  <option value="">Select subject…</option>
                  {subjects.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}

              {schedScope === "chapter" && schedSubjectKey && (
                <select
                  value={schedChapterId}
                  onChange={(e) => setSchedChapterId(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-2.5 bg-white"
                >
                  <option value="">Select chapter…</option>
                  {chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                placeholder="Test title / Target topic"
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-3 bg-white focus:outline-none focus:border-teal"
              />

              <div className="mb-4">
                <label className="text-[10px] font-bold text-slate block mb-0.5">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 p-2 text-xs font-semibold bg-white"
                />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={handleScheduleSubmit}
                className="w-full py-3 bg-teal text-white rounded-xl text-xs font-bold shadow-md shadow-teal/20 hover:bg-teal/90 disabled:opacity-40 transition-all"
              >
                {saving ? "Scheduling…" : "Schedule Test"}
              </button>
            </div>

            {/* Schedule List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate uppercase tracking-wider">
                Upcoming Planned Tests
              </h3>
              {scheduleRows.length === 0 ? (
                <p className="text-xs text-slate text-center py-6">
                  No upcoming tests scheduled.
                </p>
              ) : (
                scheduleRows.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-ticket border p-4 bg-white shadow-2xs flex items-center justify-between ${
                      item.is_done ? "border-teal/30 bg-teal/5" : "border-ink/10"
                    }`}
                  >
                    <div>
                      <h4
                        className={`text-xs font-bold ${
                          item.is_done ? "line-through text-slate" : "text-ink"
                        }`}
                      >
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-slate mt-0.5">
                        Scheduled for:{" "}
                        {new Date(item.scheduled_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>

                    <button
                      onClick={() => toggleScheduleDone(item.id, item.is_done)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition-all ${
                        item.is_done
                          ? "bg-teal text-white border-teal"
                          : "border-ink/15 text-slate hover:border-ink/30"
                      }`}
                    >
                      {item.is_done ? "✓ Done" : "Mark Done"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
