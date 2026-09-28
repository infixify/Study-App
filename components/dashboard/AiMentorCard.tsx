"use client";

import { useEffect, useState } from "react";

interface MentorReport {
  id?: string;
  overall_status: "On Track" | "Needs Attention" | "Critical Backlog" | string;
  score_prediction?: string;
  strengths: string[];
  weaknesses: string[];
  diagnostic_summary: string;
  seven_day_plan: { day: string; focus: string; target: string }[];
  action_tips: string[];
  created_at?: string;
}

export default function AiMentorCard({ userId }: { userId: string }) {
  const [report, setReport] = useState<MentorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const fetchMentorReport = async (force = false) => {
    if (force) setGenerating(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/ai-mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, forceRefresh: force }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.report) setReport(data.report);
      }
    } catch (e) {
      console.error("Mentor card load error:", e);
    } finally {
      setLoading(false);
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (userId) fetchMentorReport(false);
  }, [userId]);

  if (loading) {
    return (
      <div className="w-full p-5 rounded-ticket border border-ink/10 bg-white animate-pulse">
        <div className="h-4 bg-ink/10 rounded w-1/3 mb-2" />
        <div className="h-3 bg-ink/5 rounded w-2/3" />
      </div>
    );
  }

  const statusColor =
    report?.overall_status === "On Track"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : report?.overall_status === "Critical Backlog"
      ? "bg-rose-50 text-rose-700 border-rose-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

  return (
    <>
      <div className="rounded-ticket border border-indigo-100 bg-gradient-to-br from-white via-indigo-50/20 to-white p-5 shadow-xs relative overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-200/30 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
              🧠
            </span>
            <div>
              <h3 className="text-sm font-black text-ink">AI Personal Mentor</h3>
              <p className="text-[10px] text-slate">Kota-standard Diagnostic & Action Plan</p>
            </div>
          </div>

          {report?.overall_status && (
            <span className={`text-[10.5px] font-black px-2.5 py-1 rounded-full border ${statusColor}`}>
              ● {report.overall_status}
            </span>
          )}
        </div>

        {/* Score Prediction & Highlight */}
        {report?.score_prediction && (
          <div className="p-3 rounded-xl bg-white border border-indigo-100 shadow-2xs mb-3">
            <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Target Trajectory</p>
            <p className="text-xs font-bold text-ink mt-0.5">{report.score_prediction}</p>
          </div>
        )}

        {/* Short Summary Snippet */}
        <p className="text-xs text-slate line-clamp-2 leading-relaxed mb-4">
          {report?.diagnostic_summary || "Analyzing your study habits, test scores and backlog load…"}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all text-center"
          >
            🔍 View Full Diagnostic & 7-Day Plan
          </button>

          <button
            type="button"
            disabled={generating}
            onClick={() => fetchMentorReport(true)}
            title="Refresh AI Analysis"
            className="p-2.5 rounded-xl border border-ink/12 bg-white text-slate hover:text-ink active:scale-95 transition-all text-xs"
          >
            {generating ? "⏳" : "🔄"}
          </button>
        </div>
      </div>

      {/* 🚀 FULL MENTOR REPORT MODAL */}
      {showModal && report && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4 border border-ink/10 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-ink/8">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-base">
                  🧠
                </span>
                <div>
                  <h3 className="text-base font-black text-ink">Mentor Diagnostic Report</h3>
                  <p className="text-[11px] text-slate">Personalized Kota Academic Roadmap</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate hover:bg-ink/5"
              >
                ✕
              </button>
            </div>

            {/* Overall Status Badge */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <div>
                <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Readiness Status</p>
                <p className="text-sm font-black text-indigo-950 mt-0.5">{report.overall_status}</p>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-200">
                {report.score_prediction?.split(":")[1]?.trim() || "Active Tracking"}
              </span>
            </div>

            {/* Strengths & Weaknesses */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/70">
                <p className="text-[11px] font-bold text-emerald-900 mb-1.5 flex items-center gap-1">
                  <span>✓</span> Strengths
                </p>
                <ul className="text-[11px] text-emerald-800 space-y-1">
                  {report.strengths?.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/70">
                <p className="text-[11px] font-bold text-rose-900 mb-1.5 flex items-center gap-1">
                  <span>⚠</span> Focus Areas
                </p>
                <ul className="text-[11px] text-rose-800 space-y-1">
                  {report.weaknesses?.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Diagnostic Narrative */}
            <div className="p-4 rounded-2xl bg-paper/60 border border-ink/8">
              <h4 className="text-xs font-bold text-ink mb-1.5">Detailed Performance Analysis</h4>
              <p className="text-xs text-slate leading-relaxed whitespace-pre-line">
                {report.diagnostic_summary}
              </p>
            </div>

            {/* 7-Day Action Plan */}
            <div>
              <h4 className="text-xs font-bold text-ink mb-2">Personalized 7-Day Action Plan</h4>
              <div className="flex flex-col gap-2">
                {report.seven_day_plan?.map((plan, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-ink/10 bg-white flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 mr-2">
                        {plan.day}
                      </span>
                      <strong className="text-ink">{plan.focus}</strong>
                      <p className="text-[11px] text-slate mt-0.5">{plan.target}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coaching Action Tips */}
            <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200/70">
              <p className="text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                <span>💡</span> Mentor's Golden Advice
              </p>
              <ul className="text-xs text-amber-800 space-y-1">
                {report.action_tips?.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="w-full py-3 rounded-xl bg-ink text-paper text-xs font-bold hover:bg-ink-100 transition-all mt-1"
            >
              Got it, I'll execute this!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
