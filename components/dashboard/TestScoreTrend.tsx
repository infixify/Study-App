"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface TestLogItem {
  id: string;
  test_name: string;
  total_marks: number;
  max_marks: number;
  physics_marks?: number;
  chemistry_marks?: number;
  maths_marks?: number;
  accuracy: number;
  test_date: string;
}

export default function TestScoreTrend({ userId }: { userId: string }) {
  const [tests, setTests] = useState<TestLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Log Modal State
  const [showModal, setShowModal] = useState(false);
  const [testName, setTestName] = useState("");
  const [pMarks, setPMarks] = useState<number>(0);
  const [cMarks, setCMarks] = useState<number>(0);
  const [mMarks, setMMarks] = useState<number>(0);
  const [maxMarks, setMaxMarks] = useState<number>(300);
  const [accuracy, setAccuracy] = useState<number>(75);
  const [saving, setSaving] = useState(false);

  const fetchTests = async () => {
    if (!userId) return;
    try {
      const { data } = await supabase
        .from("test_logs")
        .select("id, test_name, total_marks, max_marks, physics_marks, chemistry_marks, maths_marks, accuracy, test_date")
        .eq("user_id", userId)
        .order("test_date", { ascending: false })
        .limit(6);

      setTests((data as TestLogItem[]) || []);
    } catch (e) {
      console.error("Fetch tests error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [userId]);

  const handleSaveTest = async () => {
    if (!userId || !testName.trim()) return;
    setSaving(true);
    const totalScore = (Number(pMarks) || 0) + (Number(cMarks) || 0) + (Number(mMarks) || 0);

    try {
      await supabase.from("test_logs").insert({
        user_id: userId,
        test_name: testName.trim(),
        total_marks: totalScore,
        max_marks: maxMarks,
        physics_marks: Number(pMarks) || 0,
        chemistry_marks: Number(cMarks) || 0,
        maths_marks: Number(mMarks) || 0,
        accuracy: accuracy,
        test_date: new Date().toISOString().slice(0, 10),
      });

      setShowModal(false);
      setTestName("");
      setPMarks(0);
      setCMarks(0);
      setMMarks(0);
      await fetchTests();
    } catch (err) {
      console.error("Save test error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-ticket border border-ink/10 bg-white p-5 animate-pulse text-xs text-slate">
        Loading test analytics…
      </div>
    );
  }

  // Reverse tests for chronological score trend left-to-right
  const chronological = [...tests].reverse();
  const latest = tests[0] || null;
  const maxScoreFound = Math.max(1, ...chronological.map((t) => t.total_marks));

  return (
    <div className="rounded-ticket border border-ink/10 bg-white p-5 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-ink">Test Performance & Trend</h3>
          <p className="text-[11px] text-slate">Mock scores & accuracy progression</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal text-white text-[11px] font-bold shadow-xs hover:bg-teal/90 active:scale-95 transition-all"
          >
            <span>+</span>
            <span>Log Test</span>
          </button>
          <Link
            href="/tests"
            className="text-[11px] font-bold text-slate hover:text-ink px-2 py-1 rounded-full bg-ink/5"
          >
            All →
          </Link>
        </div>
      </div>

      {!latest ? (
        <div className="p-4 rounded-xl border border-ink/8 bg-paper/50 text-center">
          <p className="text-xs font-semibold text-ink">No mock tests logged yet</p>
          <p className="text-[11px] text-slate mt-0.5">
            Log your latest full-syllabus or chapter test to track marks progression!
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 px-4 py-2 rounded-full bg-ink text-paper text-xs font-bold"
          >
            + Log First Test
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Latest Test Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-paper/60 border border-ink/8">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink truncate max-w-[150px]">
                  {latest.test_name}
                </span>
                <span className="text-[10px] text-slate font-medium">
                  {new Date(latest.test_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-slate">
                  P: <strong className="text-ink">{latest.physics_marks ?? "-"}</strong>
                </span>
                <span className="text-xs text-slate">
                  C: <strong className="text-ink">{latest.chemistry_marks ?? "-"}</strong>
                </span>
                <span className="text-xs text-slate">
                  M/B: <strong className="text-ink">{latest.maths_marks ?? "-"}</strong>
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xl font-black font-mono text-teal">
                {latest.total_marks}
                <span className="text-xs text-slate font-normal">/{latest.max_marks || 300}</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal/10 text-teal border border-teal/20">
                {latest.accuracy}% Accuracy
              </span>
            </div>
          </div>

          {/* Visual Score Trend Line / Bars */}
          {chronological.length > 1 && (
            <div>
              <div className="flex justify-between items-center text-[10px] text-slate font-bold mb-2 uppercase tracking-wide">
                <span>Score Progression</span>
                <span>Max: {maxScoreFound}</span>
              </div>

              <div className="flex items-end gap-2 h-24 pt-2 border-b border-ink/8 pb-2">
                {chronological.map((t, idx) => {
                  const heightPct = Math.max(10, Math.round((t.total_marks / (t.max_marks || 300)) * 100));
                  return (
                    <div key={t.id || idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-bold text-ink font-mono">{t.total_marks}</span>
                      <div className="w-full flex items-end justify-center h-16">
                        <div
                          className="w-full max-w-[24px] rounded-t-lg bg-gradient-to-t from-teal to-emerald-400 transition-all shadow-xs"
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-semibold text-slate truncate w-full text-center">
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

      {/* 🚀 QUICK LOG TEST MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 border border-ink/10">
            <div className="flex items-center justify-between pb-2 border-b border-ink/8">
              <div>
                <h4 className="text-base font-black text-ink">Log Test Score</h4>
                <p className="text-[11px] text-slate">Record your mock test results</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
              >
                ✕
              </button>
            </div>

            {/* Test Name */}
            <div>
              <label className="text-[11px] font-bold text-ink block mb-1">Test Name / Series</label>
              <input
                type="text"
                placeholder="e.g. Allen Major Test 04 / PYQ Mock 2024"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                autoFocus
              />
            </div>

            {/* Subject Marks */}
            <div>
              <label className="text-[11px] font-bold text-ink block mb-1">Subject-wise Marks</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[10px] text-slate font-bold block mb-0.5">Physics</span>
                  <input
                    type="number"
                    value={pMarks}
                    onChange={(e) => setPMarks(parseInt(e.target.value) || 0)}
                    className="w-full text-center text-xs font-bold p-2 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate font-bold block mb-0.5">Chemistry</span>
                  <input
                    type="number"
                    value={cMarks}
                    onChange={(e) => setCMarks(parseInt(e.target.value) || 0)}
                    className="w-full text-center text-xs font-bold p-2 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate font-bold block mb-0.5">Maths / Bio</span>
                  <input
                    type="number"
                    value={mMarks}
                    onChange={(e) => setMMarks(parseInt(e.target.value) || 0)}
                    className="w-full text-center text-xs font-bold p-2 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                  />
                </div>
              </div>
            </div>

            {/* Max Marks & Accuracy */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Total Max Marks</label>
                <input
                  type="number"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(parseInt(e.target.value) || 300)}
                  className="w-full text-center text-xs font-bold p-2 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Accuracy %</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={accuracy}
                  onChange={(e) => setAccuracy(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-xs font-bold p-2 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={saving || !testName.trim()}
              onClick={handleSaveTest}
              className="w-full py-3 rounded-xl bg-ink text-paper font-bold text-xs shadow-md hover:bg-ink-100 disabled:opacity-40 transition-all mt-1"
            >
              {saving ? "Saving…" : `✓ Save (${Number(pMarks) + Number(cMarks) + Number(mMarks)}/${maxMarks})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
            }
