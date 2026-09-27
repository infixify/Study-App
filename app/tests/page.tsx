// app/tests/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

type Scope = "chapter" | "subject" | "full_syllabus";

type SubjectRow = { id: string; name: string };
type ChapterRow = { id: string; title: string; subject_id: string };

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

export default function TestsPage() {
  const [targetExam, setTargetExam] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [logs, setLogs] = useState<TestLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // form state
  const [scope, setScope] = useState<Scope>("chapter");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [testName, setTestName] = useState("");
  const [totalQuestions, setTotalQuestions] = useState("");
  const [correct, setCorrect] = useState("");
  const [wrong, setWrong] = useState("");
  const [unattempted, setUnattempted] = useState("");
  const [marksScored, setMarksScored] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));

  const loadEverything = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("target_exam")
      .eq("uid", user.id)
      .maybeSingle();

    const exam = profile?.target_exam ?? null;
    setTargetExam(exam);

    const [{ data: subjectRows }, { data: logRows }] = await Promise.all([
      exam
        ? supabase.from("subjects").select("id, name").eq("target_exam", exam)
        : Promise.resolve({ data: [] as SubjectRow[] }),
      supabase
        .from("test_logs")
        .select(
          "id, scope, test_name, total_questions, correct_count, wrong_count, unattempted_count, marks_scored, max_marks, accuracy, test_date, subject_id, chapter_id"
        )
        .eq("user_id", user.id)
        .order("test_date", { ascending: false })
        .limit(50),
    ]);

    // de-dupe subjects by name (multiple class_level rows share the same name)
    const seen = new Set<string>();
    const uniqueSubjects = ((subjectRows as SubjectRow[] | null) ?? []).filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });

    setSubjects(uniqueSubjects);
    setLogs((logRows as TestLogRow[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  useEffect(() => {
    async function loadChapters() {
      if (!subjectId) {
        setChapters([]);
        return;
      }
      const { data } = await supabase
        .from("chapters")
        .select("id, title, subject_id")
        .eq("subject_id", subjectId)
        .order("display_order", { ascending: true });
      setChapters((data as ChapterRow[] | null) ?? []);
    }
    if (scope === "chapter") loadChapters();
  }, [subjectId, scope]);

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

  async function handleSave() {
    setError(null);

    if (!testName.trim()) return setError("Give the test a name.");
    if (!totalQuestions) return setError("Total questions is required.");
    if (scope === "chapter" && !chapterId) return setError("Pick a chapter.");
    if (scope === "subject" && !subjectId) return setError("Pick a subject.");

    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const user = authData?.user;
    if (!user) {
      setError("Not signed in.");
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("test_logs").insert({
      user_id: user.id,
      scope,
      chapter_id: scope === "chapter" ? chapterId : null,
      subject_id: scope === "chapter" || scope === "subject" ? subjectId || null : null,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="text-ink/60 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper pb-24">
      <div className="max-w-md mx-auto px-5 pt-8">
        <h1 className="font-display text-2xl font-semibold mb-1">Test Scores</h1>
        <p className="text-slate text-sm mb-6">
          Log scores from tests you've already taken — chapter-wise, subject-wise, or full
          syllabus mocks. This isn't a test engine — just your record, tracked over time.
        </p>

        {/* ---- Add new log ---- */}
        <div className="rounded-ticket border border-ink/10 bg-white p-4 mb-8">
          <p className="text-sm font-medium mb-3">Log a test</p>

          <div className="flex gap-2 mb-3">
            {(["chapter", "subject", "full_syllabus"] as Scope[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScope(s);
                  setSubjectId("");
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
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border border-ink/15 p-2.5 text-sm mb-2"
            >
              <option value="">Select subject…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}

          {scope === "chapter" && subjectId && (
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

        {/* ---- Past logs ---- */}
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
                    ·{" "}
                    {log.scope === "chapter"
                      ? "Chapter test"
                      : log.scope === "subject"
                      ? "Subject test"
                      : "Full syllabus"}
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
      </div>
    </div>
  );
    }
