// app/tests/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [pMarks, setPMarks] = useState("");
  const [cMarks, setCMarks] = useState("");
  const [mMarks, setMMarks] = useState("");
  const [totalQuestions, setTotalQuestions] = useState("75");
  const [correct, setCorrect] = useState("");
  const [wrong, setWrong] = useState("");
  const [unattempted, setUnattempted] = useState("");
  const [marksScored, setMarksScored] = useState("");
  const [maxMarks, setMaxMarks] = useState("300");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));

  // --- schedule-a-test form state ---
  const [schedScope, setSchedScope] = useState<Scope>("chapter");
  const [schedSubjectKey, setSchedSubjectKey] = useState("");
  const [schedChapterId, setSchedChapterId] = useState("");
  const [schedChapters, setSchedChapters] = useState<ChapterOption[]>([]);
  const [schedTitle, setSchedTitle] = useState("");
  const [schedDate, setSchedDate] = useState(new Date().toISOString().slice(0, 10));
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedError, setSchedError] = useState<string | null>(null);

  const loadEverything = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("target_exam, class_level")
      .eq("uid", user.id)
      .maybeSingle();

    const exam = profile?.target_exam ?? null;
    setTargetExam(exam);

    const rawClass = profile?.class_level ?? null;
    const pureDropper = rawClass === "Dropper";
    setIsPureDropper(pureDropper);

    const classesToFetch: string[] =
      rawClass === "Dropper" ? ["Dropper"] : rawClass === "11_12" ? ["11", "12"] : rawClass ? [rawClass] : [];

    const [{ data: subjectRows }, { data: logRows }, { data: schedRows }] = await Promise.all([
      exam && classesToFetch.length
        ? supabase
            .from("subjects")
            .select("id, name, class_level")
            .eq("target_exam", exam)
            .in("class_level", classesToFetch)
        : Promise.resolve({ data: [] as { id: string; name: string; class_level: string }[] }),
      supabase
        .from("test_logs")
        .select(
          "id, scope, test_name, total_questions, correct_count, wrong_count, unattempted_count, marks_scored, max_marks, physics_marks, chemistry_marks, maths_marks, accuracy, test_date, subject_id, chapter_id"
        )
        .eq("user_id", user.id)
        .order("test_date", { ascending: false })
        .limit(50),
      supabase
        .from("test_schedule")
        .select("id, title, scope, subject_id, chapter_id, scheduled_date, is_done")
        .eq("user_id", user.id)
        .order("scheduled_date", { ascending: true }),
    ]);

    const grouped = new Map<string, SubjectOption>();
    (subjectRows ?? []).forEach((row) => {
      const existing = grouped.get(row.name);
      if (existing) {
        existing.sources.push({ id: row.id, classLevel: row.class_level });
      } else {
        grouped.set(row.name, {
          key: row.name,
          name: row.name,
          sources: [{ id: row.id, classLevel: row.class_level }],
        });
      }
    });

    setSubjects(Array.from(grouped.values()));
    setLogs((logRows as TestLogRow[] | null) ?? []);
    setScheduleRows((schedRows as ScheduleRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  useEffect(() => {
    async function loadChapters() {
      const subject = subjects.find((s) => s.key === subjectKey);
      if (!subject) {
        setChapters([]);
        return;
      }

      const ids = subject.sources.map((s) => s.id);
      let query = supabase
        .from("chapters")
        .select("id, title, subject_id, display_order")
        .in("subject_id", ids)
        .order("display_order", { ascending: true });

      if (isPureDropper) {
        query = query.eq("in_competitive_syllabus", true);
      }

      const { data } = await query;

      const idToClass = new Map(subject.sources.map((s) => [s.id, s.classLevel]));
      const mapped: ChapterOption[] = (data ?? []).map((c) => ({
        id: c.id,
        title:
          subject.sources.length > 1
            ? `${idToClass.get(c.subject_id) === "11" ? "XI" : "XII"} — ${c.title}`
            : c.title,
        classLevel: idToClass.get(c.subject_id) ?? "",
      }));

      setChapters(mapped);
    }
    if (scope === "chapter") loadChapters();
  }, [subjectKey, scope, subjects, isPureDropper]);

  useEffect(() => {
    async function loadSchedChapters() {
      const subject = subjects.find((s) => s.key === schedSubjectKey);
      if (!subject) {
        setSchedChapters([]);
        return;
      }

      const ids = subject.sources.map((s) => s.id);
      let query = supabase
        .from("chapters")
        .select("id, title, subject_id, display_order")
        .in("subject_id", ids)
        .order("display_order", { ascending: true });

      if (isPureDropper) {
        query = query.eq("in_competitive_syllabus", true);
      }

      const { data } = await query;

      const idToClass = new Map(subject.sources.map((s) => [s.id, s.classLevel]));
      const mapped: ChapterOption[] = (data ?? []).map((c) => ({
        id: c.id,
        title:
          subject.sources.length > 1
            ? `${idToClass.get(c.subject_id) === "11" ? "XI" : "XII"} — ${c.title}`
            : c.title,
        classLevel: idToClass.get(c.subject_id) ?? "",
      }));

      setSchedChapters(mapped);
    }
    if (schedScope === "chapter") loadSchedChapters();
  }, [schedSubjectKey, schedScope, subjects, isPureDropper]);

  function resetForm() {
    setTestName("");
    setTotalQuestions("75");
    setCorrect("");
    setWrong("");
    setUnattempted("");
    setMarksScored("");
    setMaxMarks("300");
    setPMarks("");
    setCMarks("");
    setMMarks("");
    setChapterId("");
  }

  function resetSchedForm() {
    setSchedTitle("");
    setSchedChapterId("");
  }

  async function handleSave() {
    setError(null);

    if (!testName.trim()) return setError("Please enter the test name.");
    if (scope === "chapter" && !chapterId) return setError("Please pick a chapter.");
    if (scope === "subject" && !subjectKey) return setError("Please pick a subject.");

    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const subject = subjects.find((s) => s.key === subjectKey);
    const representativeSubjectId = subject?.sources[0]?.id ?? null;

    // Calculate marks from subject breakdown if provided
    const calculatedMarks =
      pMarks || cMarks || mMarks
        ? (Number(pMarks) || 0) + (Number(cMarks) || 0) + (Number(mMarks) || 0)
        : marksScored
        ? Number(marksScored)
        : null;

    const { error: insertError } = await supabase.from("test_logs").insert({
      user_id: user.id,
      scope,
      chapter_id: scope === "chapter" ? chapterId : null,
      subject_id: scope === "chapter" || scope === "subject" ? representativeSubjectId : null,
      test_name: testName.trim(),
      target_exam: targetExam,
      total_questions: Number(totalQuestions) || 75,
      correct_count: Number(correct) || 0,
      wrong_count: Number(wrong) || 0,
      unattempted_count: Number(unattempted) || 0,
      marks_scored: calculatedMarks,
      max_marks: maxMarks ? Number(maxMarks) : 300,
      physics_marks: pMarks ? Number(pMarks) : null,
      chemistry_marks: cMarks ? Number(cMarks) : null,
      maths_marks: mMarks ? Number(mMarks) : null,
      test_date: testDate,
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      resetForm();
      await loadEverything();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("test_logs").delete().eq("id", id);
    await loadEverything();
  }

  async function handleScheduleSave() {
    setSchedError(null);

    if (!schedTitle.trim()) return setSchedError("Give it a title.");
    if (schedScope === "chapter" && !schedChapterId) return setSchedError("Pick a chapter.");
    if (schedScope === "subject" && !schedSubjectKey) return setSchedError("Pick a subject.");

    setSchedSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setSchedError("Not signed in.");
      setSchedSaving(false);
      return;
    }

    const subject = subjects.find((s) => s.key === schedSubjectKey);
    const representativeSubjectId = subject?.sources[0]?.id ?? null;

    const { error: insertError } = await supabase.from("test_schedule").insert({
      user_id: user.id,
      title: schedTitle.trim(),
      scope: schedScope,
      chapter_id: schedScope === "chapter" ? schedChapterId : null,
      subject_id: schedScope === "chapter" || schedScope === "subject" ? representativeSubjectId : null,
      scheduled_date: schedDate,
      is_done: false,
    });

    if (insertError) {
      setSchedError(insertError.message);
    } else {
      resetSchedForm();
      await loadEverything();
    }
    setSchedSaving(false);
  }

  async function toggleScheduleDone(row: ScheduleRow) {
    await supabase.from("test_schedule").update({ is_done: !row.is_done }).eq("id", row.id);
    await loadEverything();
  }

  async function deleteScheduleRow(id: string) {
    await supabase.from("test_schedule").delete().eq("id", id);
    await loadEverything();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading test data…</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdueRows = scheduleRows.filter((r) => !r.is_done && r.scheduled_date < today);
  const upcomingRows = scheduleRows.filter((r) => !r.is_done && r.scheduled_date >= today);
  const doneRows = scheduleRows.filter((r) => r.is_done);

  function scopeLabel(s: Scope) {
    return s === "chapter" ? "Chapter test" : s === "subject" ? "Subject test" : "Full syllabus mock";
  }

  // Calculate high-level metrics for the analytics banner
  const validAccuracies = logs.map((l) => l.accuracy).filter((a): a is number => a != null);
  const avgAccuracy = validAccuracies.length
    ? Math.round(validAccuracies.reduce((sum, a) => sum + a, 0) / validAccuracies.length)
    : 0;

  const validScores = logs.map((l) => l.marks_scored).filter((s): s is number => s != null);
  const avgScore = validScores.length
    ? Math.round(validScores.reduce((sum, s) => sum + s, 0) / validScores.length)
    : 0;

  const chronologicalLogs = [...logs].reverse();

  return (
    <div className="min-h-screen bg-paper pb-28 font-sans">
      {/* Sleek AppHeader */}
      <AppHeader />

      <main className="max-w-md mx-auto px-5 pt-4">
        {/* Top Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-black text-ink">Test Analytics & Tracker</h1>
          <p className="text-xs text-slate mt-0.5">
            Log mock scores, track accuracy & visualize your JEE/NEET rank readiness
          </p>
        </div>

        {/* 📈 JEETrack-Style Summary & Score Progression Curve */}
        {logs.length > 0 && (
          <div className="rounded-ticket border border-ink/10 bg-white p-5 shadow-xs mb-5">
            <div className="grid grid-cols-3 gap-2 pb-4 border-b border-ink/8 text-center">
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Tests Given</p>
                <p className="text-xl font-black text-ink mt-0.5">{logs.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Avg Score</p>
                <p className="text-xl font-black text-teal mt-0.5">{avgScore}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate uppercase tracking-wider">Avg Accuracy</p>
                <p className="text-xl font-black text-emerald-600 mt-0.5">{avgAccuracy}%</p>
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
                    const heightPct = Math.max(12, Math.round(((t.marks_scored || 0) / (t.max_marks || 300)) * 100));
                    return (
                      <div key={t.id || idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[9px] font-bold text-ink font-mono">{t.marks_scored ?? "-"}</span>
                        <div className="w-full flex items-end justify-center h-16">
                          <div
                            className="w-full max-w-[20px] rounded-t-md bg-gradient-to-t from-teal to-emerald-400 transition-all shadow-xs"
                            style={{ height: `${heightPct}%` }}
                            title={`${t.test_name}: ${t.marks_scored}/${t.max_marks}`}
                          />
                        </div>
                        <span className="text-[8.5px] font-semibold text-slate truncate w-full text-center">
                          {new Date(t.test_date).toLocaleDateString("en-IN", { day: "numeric", month: "narrow" })}
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

        {/* ========================================================================= */}
        {/* VIEW 1: LOG SCORES                                                        */}
        {/* ========================================================================= */}
        {view === "log" && (
          <>
            {/* Log Form Card */}
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
                      setSubjectKey("");
                      setChapterId("");
                    }}
                    className={`flex-1 text-[11px] rounded-xl py-2 font-bold transition-all border ${
                      scope === s
                        ? "bg-marigold/15 border-marigold text-ink shadow-2xs"
                        : "border-ink/10 bg-paper/50 text-slate hover:border-ink/25"
                    }`}
                  >
                    {s === "full_syllabus" ? "Full Syllabus" : s === "subject" ? "Subject" : "Chapter"}
                  </button>
                ))}
              </div>

              {(scope === "chapter" || scope === "subject") && (
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

              <input
                type="text"
                placeholder="Test name (e.g. Allen Major Test 04 / FIITJEE AITS)"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-3 bg-white focus:outline-none focus:border-teal"
              />

              {/* Subject-Wise Marks Breakdown (For JEE/NEET Mocks) */}
              <div className="p-3 rounded-xl bg-paper/60 border border-ink/8 mb-3">
                <p className="text-[11px] font-bold text-ink mb-1.5">Subject Marks (Optional Breakdown)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-[9.5px] font-bold text-slate block mb-0.5">Physics</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={pMarks}
                      onChange={(e) => setPMarks(e.target.value)}
                      className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                    />
                  </div>
                  <div>
                    <span className="text-[9.5px] font-bold text-slate block mb-0.5">Chemistry</span>
                    <input
                      type="number"
                      placeholder="0"
                      value={cMarks}
                      onChange={(e) => setCMarks(e.target.value)}
                      className="w-full text-center text-xs font-bold p-2 rounded-lg border border-ink/15 bg-white focus:outline-none focus:border-teal"
                    />
                  </div>
                  <div>
                    <span className="text-[9.5px] font-bold text-slate block mb-0.5">Maths / Bio</span>
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

              {/* Question counts */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">Correct (+)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={correct}
                    onChange={(e) => setCorrect(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold text-emerald-700 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">Wrong (-)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={wrong}
                    onChange={(e) => setWrong(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold text-rose-700 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">Skipped</label>
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
                  <label className="text-[10px] font-bold text-slate block mb-0.5">Total Marks Scored</label>
                  <input
                    type="number"
                    placeholder={
                      pMarks || cMarks || mMarks
                        ? String((Number(pMarks) || 0) + (Number(cMarks) || 0) + (Number(mMarks) || 0))
                        : "e.g. 185"
                    }
                    value={marksScored}
                    onChange={(e) => setMarksScored(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate block mb-0.5">Max Marks</label>
                  <input
                    type="number"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(e.target.value)}
                    className="w-full rounded-xl border border-ink/15 p-2 text-xs font-bold bg-white"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-[10px] font-bold text-slate block mb-0.5">Test Date</label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full rounded-xl border border-ink/15 p-2 text-xs font-semibold bg-white"
                />
              </div>

              {error && <p className="text-xs text-rose-600 mb-2 font-medium">{error}</p>}

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-ink text-paper rounded-2xl py-3.5 text-xs font-bold shadow-md hover:bg-ink-100 disabled:opacity-40 transition-all"
              >
                {saving ? "Saving…" : "✓ Save Test Score"}
              </button>
            </div>

            {/* Test History List */}
            <div className="mb-4">
              <h3 className="text-sm font-bold text-ink mb-2.5">Your Test History</h3>
              {logs.length === 0 ? (
                <p className="text-xs text-slate py-4 text-center">No tests logged yet. Add your first score above!</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-ticket border border-ink/10 bg-white p-4 shadow-2xs hover:border-ink/20 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-ink">{log.test_name}</p>
                          <p className="text-[10px] text-slate mt-0.5">
                            {new Date(log.test_date).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            · {scopeLabel(log.scope)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(log.id)}
                          className="text-[10px] font-bold text-rose-500 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Marks & Accuracy Pill */}
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-ink/5">
                        <div>
                          {log.marks_scored != null ? (
                            <span className="text-sm font-black font-mono text-teal">
                              {log.marks_scored}
                              <span className="text-[10px] text-slate font-normal">/{log.max_marks || 300}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate">Score not logged</span>
                          )}
                        </div>

                        {log.accuracy != null && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {log.accuracy}% Accuracy
                          </span>
                        )}
                      </div>

                      {/* Detailed stats */}
                      <div className="flex gap-3 mt-2 text-[10px]">
                        <span className="text-emerald-600 font-semibold">{log.correct_count} correct</span>
                        <span className="text-rose-600 font-semibold">{log.wrong_count} wrong</span>
                        <span className="text-slate">{log.unattempted_count} skipped</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: SCHEDULE TESTS                                                    */}
        {/* ========================================================================= */}
        {view === "schedule" && (
          <>
            <div className="rounded-ticket border border-ink/10 bg-white p-5 mb-6 shadow-xs">
              <h3 className="text-sm font-bold text-ink mb-1">Schedule an Upcoming Test</h3>
              <p className="text-[11px] text-slate mb-3">Plan your mock tests or chapter-wise tests in advance</p>

              <div className="flex gap-1.5 mb-3">
                {(["chapter", "subject", "full_syllabus"] as Scope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSchedScope(s);
                      setSchedSubjectKey("");
                      setSchedChapterId("");
                    }}
                    className={`flex-1 text-[11px] rounded-xl py-2 font-bold transition-all border ${
                      schedScope === s
                        ? "bg-marigold/15 border-marigold text-ink"
                        : "border-ink/10 bg-paper/50 text-slate"
                    }`}
                  >
                    {s === "chapter" ? "Chapter" : s === "subject" ? "Subject" : "Full syllabus"}
                  </button>
                ))}
              </div>

              {(schedScope === "chapter" || schedScope === "subject") && (
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
                  {schedChapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="text"
                placeholder="Title (e.g. Modern Physics full revision test)"
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-2.5 bg-white focus:outline-none focus:border-teal"
              />

              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full rounded-xl border border-ink/15 p-2.5 text-xs font-semibold mb-3 bg-white"
              />

              {schedError && <p className="text-xs text-rose-600 mb-2">{schedError}</p>}

              <button
                type="button"
                onClick={handleScheduleSave}
                disabled={schedSaving}
                className="w-full bg-ink text-paper rounded-2xl py-3.5 text-xs font-bold shadow-md hover:bg-ink-100 disabled:opacity-40 transition-all"
              >
                {schedSaving ? "Saving…" : "✓ Schedule Test"}
              </button>
            </div>

            {overdueRows.length > 0 && (
              <ScheduleGroup
                title="Overdue"
                rows={overdueRows}
                onToggle={toggleScheduleDone}
                onDelete={deleteScheduleRow}
                scopeLabel={scopeLabel}
                accent="text-rose-600"
              />
            )}
            <ScheduleGroup
              title="Upcoming"
              rows={upcomingRows}
              onToggle={toggleScheduleDone}
              onDelete={deleteScheduleRow}
              scopeLabel={scopeLabel}
              accent="text-ink"
            />
            {doneRows.length > 0 && (
              <ScheduleGroup
                title="Completed"
                rows={doneRows}
                onToggle={toggleScheduleDone}
                onDelete={deleteScheduleRow}
                scopeLabel={scopeLabel}
                accent="text-teal"
              />
            )}
          </>
        )}
      </main>

      {/* Persistent Bottom Nav */}
      <BottomNav />
    </div>
  );
}

function ScheduleGroup({
  title,
  rows,
  onToggle,
  onDelete,
  scopeLabel,
  accent,
}: {
  title: string;
  rows: ScheduleRow[];
  onToggle: (row: ScheduleRow) => void;
  onDelete: (id: string) => void;
  scopeLabel: (s: Scope) => string;
  accent: string;
}) {
  return (
    <div className="mb-6">
      <p className={`text-xs font-bold mb-2.5 uppercase tracking-wider ${accent}`}>
        {title} ({rows.length})
      </p>
      {rows.length === 0 && <p className="text-xs text-slate">Nothing scheduled here.</p>}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="rounded-ticket border border-ink/10 bg-white p-3.5 flex items-center justify-between shadow-2xs"
          >
            <div>
              <p className="text-xs font-bold text-ink">{row.title}</p>
              <p className="text-[10px] text-slate mt-0.5">
                {new Date(row.scheduled_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {scopeLabel(row.scope)}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => onToggle(row)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  row.is_done
                    ? "bg-ink/5 text-slate"
                    : "bg-teal/10 text-teal hover:bg-teal/20"
                }`}
              >
                {row.is_done ? "Undo" : "Mark Done"}
              </button>
              <button
                onClick={() => onDelete(row.id)}
                className="text-[11px] font-bold text-rose-500 hover:text-rose-700"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
