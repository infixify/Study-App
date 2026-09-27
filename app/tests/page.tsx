// app/tests/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

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
  const [scope, setScope] = useState<Scope>("chapter");
  const [subjectKey, setSubjectKey] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [testName, setTestName] = useState("");
  const [totalQuestions, setTotalQuestions] = useState("");
  const [correct, setCorrect] = useState("");
  const [wrong, setWrong] = useState("");
  const [unattempted, setUnattempted] = useState("");
  const [marksScored, setMarksScored] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
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
          "id, scope, test_name, total_questions, correct_count, wrong_count, unattempted_count, marks_scored, max_marks, accuracy, test_date, subject_id, chapter_id"
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

  // Same chapter-loading logic, but for the schedule form's independent subject/scope state.
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
    setTotalQuestions("");
    setCorrect("");
    setWrong("");
    setUnattempted("");
    setMarksScored("");
    setMaxMarks("");
    setChapterId("");
  }

  function resetSchedForm() {
    setSchedTitle("");
    setSchedChapterId("");
  }

  async function handleSave() {
    setError(null);

    if (!testName.trim()) return setError("Give the test a name.");
    if (!totalQuestions) return setError("Total questions is required.");
    if (scope === "chapter" && !chapterId) return setError("Pick a chapter.");
    if (scope === "subject" && !subjectKey) return setError("Pick a subject.");

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

    const { error: insertError } = await supabase.from("test_logs").insert({
      user_id: user.id,
      scope,
      chapter_id: scope === "chapter" ? chapterId : null,
      subject_id: scope === "chapter" || scope === "subject" ? representativeSubjectId : null,
      test_name: testName.trim(),
      target_exam: targetExam,
      total_questions: Number(totalQuestions),
      correct_count: Number(correct) || 0,
      wrong_count: Number(wrong) || 0,
      unattempted_count: Number(unattempted) || 0,
      marks_scored: marksScored ? Number(marksScored) : null,
      max_marks: maxMarks ? Number(maxMarks) : null,
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
        <p className="text-ink/60 text-sm">Loading…</p>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdueRows = scheduleRows.filter((r) => !r.is_done && r.scheduled_date < today);
  const upcomingRows = scheduleRows.filter((r) => !r.is_done && r.scheduled_date >= today);
  const doneRows = scheduleRows.filter((r) => r.is_done);

  function scopeLabel(s: Scope) {
    return s === "chapter" ? "Chapter test" : s === "subject" ? "Subject test" : "Full syllabus";
  }

  return (
    <div className="min-h-screen bg-paper pb-24">
      <div className="max-w-md mx-auto px-5 pt-8">
        <h1 className="font-display text-2xl font-semibold mb-1">Tests</h1>

        <div className="flex gap-2 mb-6 mt-3">
          <button
            onClick={() => setView("log")}
            className={`flex-1 text-xs rounded-full py-2.5 font-medium border ${
              view === "log" ? "bg-marigold/15 border-marigold text-ink" : "border-ink/12 text-slate"
            }`}
          >
            Log Scores
          </button>
          <button
            onClick={() => setView("schedule")}
            className={`flex-1 text-xs rounded-full py-2.5 font-medium border ${
              view === "schedule" ? "bg-marigold/15 border-marigold text-ink" : "border-ink/12 text-slate"
            }`}
          >
            Schedule Tests
          </button>
        </div>

        {view === "log" && (
          <>
            <p className="text-slate text-sm mb-6">
              Log scores from tests you've already taken — chapter-wise, subject-wise, or full
              syllabus mocks. This isn't a test engine — just your record, tracked over time.
            </p>

            <div className="rounded-ticket border border-ink/10 bg-white p-4 mb-8">
              <p className="text-sm font-medium mb-3">Log a test</p>

              <div className="flex gap-2 mb-3">
                {(["chapter", "subject", "full_syllabus"] as Scope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setScope(s);
                      setSubjectKey("");
                      setChapterId("");
                    }}
                    className={`flex-1 text-xs rounded-full py-2 font-medium border ${
                      scope === s ? "bg-marigold/15 border-marigold text-ink" : "border-ink/12 text-slate"
                    }`}
                  >
                    {s === "chapter" ? "Chapter" : s === "subject" ? "Subject" : "Full syllabus"}
                  </button>
                ))}
              </div>

              {(scope === "chapter" || scope === "subject") && (
                <select
                  value={subjectKey}
                  onChange={(e) => setSubjectKey(e.target.value)}
                  className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
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
                  className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
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
                placeholder="Test name (e.g. Allen Weekly Test #6)"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
              />

              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  placeholder="Total questions"
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(e.target.value)}
                  className="rounded-lg border border-ink/15 p-2.5 text-sm"
                />
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="rounded-lg border border-ink/15 p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <input
                  type="number"
                  placeholder="Correct"
                  value={correct}
                  onChange={(e) => setCorrect(e.target.value)}
                  className="rounded-lg border border-ink/15 p-2.5 text-sm"
                />
                <input
                  type="number"
                  placeholder="Wrong"
                  value={wrong}
                  onChange={(e) => setWrong(e.target.value)}
                  className="rounded-lg border border-ink/15 p-2.5 text-sm"
                />
                <input
                  type="number"
                  placeholder="Skipped"
                  value={unattempted}
                  onChange={(e) => setUnattempted(e.target.value)}
                  className="rounded-lg border border-ink/15 p-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <input
                  type="number"
                  placeholder="Marks scored (optional)"
                  value={marksScored}
                  onChange={(e) => setMarksScored(e.target.value)}
                  className="rounded-lg border border-ink/15 p-2.5 text-sm"
                />
                <input
                  type="number"
                  placeholder="Max marks (optional)"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(e.target.value)}
                  className="rounded-lg border border-ink/15 p-2.5 text-sm"
                />
              </div>

              {error && <p className="text-xs text-coral mb-2">{error}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-ink text-paper rounded-ticket py-3 text-sm font-medium disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save score"}
              </button>
            </div>

            <p className="text-sm font-medium mb-3">Your test history</p>
            {logs.length === 0 && (
              <p className="text-sm text-slate">No tests logged yet — add your first one above.</p>
            )}
            <div className="flex flex-col gap-2.5">
              {logs.map((log) => (
                <div key={log.id} className="rounded-ticket border border-ink/10 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{log.test_name}</p>
                      <p className="text-xs text-slate mt-0.5">
                        {new Date(log.test_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · {scopeLabel(log.scope)}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(log.id)} className="text-xs text-coral">
                      Remove
                    </button>
                  </div>

                  <div className="flex gap-4 mt-3 text-xs">
                    <span className="text-teal font-medium">{log.correct_count} correct</span>
                    <span className="text-coral font-medium">{log.wrong_count} wrong</span>
                    <span className="text-slate">{log.unattempted_count} skipped</span>
                    {log.accuracy != null && (
                      <span className="ml-auto font-medium">{log.accuracy}% accuracy</span>
                    )}
                  </div>

                  {log.marks_scored != null && log.max_marks != null && (
                    <p className="text-xs text-slate mt-1">
                      {log.marks_scored} / {log.max_marks} marks
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {view === "schedule" && (
          <>
            <p className="text-slate text-sm mb-6">
              Plan a future test — chapter, subject, or full syllabus — and mark it done once
              taken. Reminders show up here only (no push notifications).
            </p>

            <div className="rounded-ticket border border-ink/10 bg-white p-4 mb-8">
              <p className="text-sm font-medium mb-3">Schedule a test</p>

              <div className="flex gap-2 mb-3">
                {(["chapter", "subject", "full_syllabus"] as Scope[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSchedScope(s);
                      setSchedSubjectKey("");
                      setSchedChapterId("");
                    }}
                    className={`flex-1 text-xs rounded-full py-2 font-medium border ${
                      schedScope === s ? "bg-marigold/15 border-marigold text-ink" : "border-ink/12 text-slate"
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
                  className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
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
                  className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
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
                placeholder="Title (e.g. Kinematics revision test)"
                value={schedTitle}
                onChange={(e) => setSchedTitle(e.target.value)}
                className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
              />

              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-3"
              />

              {schedError && <p className="text-xs text-coral mb-2">{schedError}</p>}

              <button
                onClick={handleScheduleSave}
                disabled={schedSaving}
                className="w-full bg-ink text-paper rounded-ticket py-3 text-sm font-medium disabled:opacity-40"
              >
                {schedSaving ? "Saving…" : "Schedule test"}
              </button>
            </div>

            {overdueRows.length > 0 && (
              <ScheduleGroup
                title="Overdue"
                rows={overdueRows}
                onToggle={toggleScheduleDone}
                onDelete={deleteScheduleRow}
                scopeLabel={scopeLabel}
                accent="text-coral"
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
                title="Done"
                rows={doneRows}
                onToggle={toggleScheduleDone}
                onDelete={deleteScheduleRow}
                scopeLabel={scopeLabel}
                accent="text-teal"
              />
            )}
          </>
        )}
      </div>
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
      <p className={`text-sm font-medium mb-3 ${accent}`}>
        {title} ({rows.length})
      </p>
      {rows.length === 0 && <p className="text-sm text-slate">Nothing here.</p>}
      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <div key={row.id} className="rounded-ticket border border-ink/10 bg-white p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-slate mt-0.5">
                {new Date(row.scheduled_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {scopeLabel(row.scope)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggle(row)}
                className={`text-xs font-medium ${row.is_done ? "text-slate" : "text-teal"}`}
              >
                {row.is_done ? "Undo" : "Mark done"}
              </button>
              <button onClick={() => onDelete(row.id)} className="text-xs text-coral">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
