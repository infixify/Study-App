"use client";

import { createElement as e, useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function FocusPage() {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [savedDuration, setSavedDuration] = useState(0);

  // Question log form state
  const [qCount, setQCount] = useState<number>(0);
  const [selectedSub, setSelectedSub] = useState<string>("General");
  const [saving, setSaving] = useState(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const h = Math.floor(m / 60);
    const remM = m % 60;
    if (h > 0) {
      return (
        (h < 10 ? "0" + h : h) +
        ":" +
        (remM < 10 ? "0" + remM : remM) +
        ":" +
        (s < 10 ? "0" + s : s)
      );
    }
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  };

  const handleStopSession = () => {
    if (seconds >= 30) {
      setIsActive(false);
      setSavedDuration(seconds);
      setShowModal(true);
    } else {
      setIsActive(false);
      setSeconds(0);
    }
  };

  const handleFinishAndSave = async (onlyTheory: boolean) => {
    setSaving(true);
    try {
      if (userId && savedDuration >= 120) {
        // 1. Save focus session
        await supabase.from("focus_sessions").insert({
          user_id: userId,
          duration_seconds: savedDuration,
          started_at: new Date(Date.now() - savedDuration * 1000).toISOString(),
          ended_at: new Date().toISOString(),
          counts_for_streak: true,
        });

        // 2. Save question logs if questions were entered
        if (!onlyTheory && qCount > 0) {
          await supabase.from("question_logs").insert({
            user_id: userId,
            question_count: qCount,
            log_date: new Date().toISOString().split("T")[0],
          });
        }
      }
    } catch (err) {
      console.error("Save session error:", err);
    } finally {
      setSaving(false);
      setShowModal(false);
      setSeconds(0);
      setQCount(0);
    }
  };

  return e(
    "div",
    { className: "min-h-screen bg-paper flex flex-col items-center justify-between p-6 pb-24 font-sans" },
    
    // Header
    e(
      "div",
      { className: "w-full max-w-sm flex items-center justify-between pt-4" },
      e(
        "div",
        null,
        e("h1", { className: "text-xl font-black text-ink" }, "Focus Mode"),
        e("p", { className: "text-xs text-slate" }, "Deep study stopwatch & practice tracker")
      ),
      e("a", { href: "/dashboard", className: "text-xs font-bold text-teal px-3 py-1.5 rounded-xl bg-teal/10" }, "Dashboard")
    ),

    // Timer Circle
    e(
      "div",
      { className: "flex flex-col items-center justify-center my-auto" },
      e(
        "div",
        {
          className:
            "w-64 h-64 rounded-full border-4 flex flex-col items-center justify-center bg-white shadow-xl transition-all " +
            (isActive ? "border-teal shadow-teal/10 animate-pulse" : "border-ink/10"),
        },
        e("span", { className: "text-5xl font-black tracking-tight text-ink font-mono" }, formatTime(seconds)),
        e("span", { className: "text-xs font-semibold text-slate mt-2 uppercase tracking-widest" }, isActive ? "Studying Now" : "Paused")
      )
    ),

    // Controls
    e(
      "div",
      { className: "w-full max-w-sm flex flex-col gap-3" },
      !isActive
        ? e(
            "button",
            {
              type: "button",
              onClick: () => setIsActive(true),
              className: "w-full py-4 rounded-2xl bg-teal text-white font-bold text-base shadow-lg shadow-teal/20 hover:bg-teal/90 transition-all",
            },
            seconds === 0 ? "🚀 Start Studying" : "▶ Resume Session"
          )
        : e(
            "button",
            {
              type: "button",
              onClick: handleStopSession,
              className: "w-full py-4 rounded-2xl bg-rose-500 text-white font-bold text-base shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all",
            },
            "⏹ End Session & Log Questions"
          ),
      seconds > 0 && !isActive
        ? e(
            "button",
            {
              type: "button",
              onClick: () => setSeconds(0),
              className: "w-full py-2.5 rounded-xl text-xs font-bold text-slate hover:bg-ink/5 transition-all text-center",
            },
            "Reset Timer"
          )
        : null
    ),

    // Question Log Modal (Popup)
    showModal
      ? e(
          "div",
          { className: "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" },
          e(
            "div",
            { className: "w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-5 border border-ink/10" },
            
            e(
              "div",
              { className: "text-center" },
              e("div", { className: "w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 text-2xl font-bold flex items-center justify-center mx-auto mb-2" }, "🎯"),
              e("h3", { className: "text-lg font-black text-ink" }, "Session Complete!"),
              e("p", { className: "text-xs text-slate mt-0.5" }, "You studied for " + Math.round(savedDuration / 60) + " minutes. Log your practice?")
            ),

            // Question counter inputs
            e(
              "div",
              { className: "flex flex-col gap-3 bg-paper p-4 rounded-2xl border border-ink/5" },
              e("label", { className: "text-xs font-bold text-ink" }, "How many questions did you solve?"),
              e(
                "div",
                { className: "flex items-center gap-3" },
                e("input", {
                  type: "number",
                  min: 0,
                  value: qCount === 0 ? "" : qCount,
                  placeholder: "0",
                  onChange: (ev) => setQCount(parseInt(ev.target.value) || 0),
                  className: "w-24 text-center text-xl font-bold p-3 rounded-xl border border-ink/15 bg-white focus:outline-none focus:border-teal",
                }),
                e(
                  "div",
                  { className: "flex items-center gap-1.5 flex-1" },
                  [10, 25, 50].map((inc) =>
                    e(
                      "button",
                      {
                        key: inc,
                        type: "button",
                        onClick: () => setQCount((prev) => prev + inc),
                        className: "flex-1 py-3 text-xs font-bold rounded-xl bg-white border border-ink/10 text-ink hover:bg-teal hover:text-white transition-all",
                      },
                      "+" + inc
                    )
                  )
                )
              )
            ),

            // Primary actions
            e(
              "div",
              { className: "flex flex-col gap-2 pt-2" },
              
              // 1. Submit with questions
              qCount > 0
                ? e(
                    "button",
                    {
                      type: "button",
                      disabled: saving,
                      onClick: () => handleFinishAndSave(false),
                      className: "w-full py-4 rounded-xl bg-teal text-white font-bold text-sm shadow-lg shadow-teal/20 hover:bg-teal/90 transition-all",
                    },
                    saving ? "Saving..." : "✓ Save " + qCount + " Questions & Focus Time"
                  )
                : null,

              // 2. Clear Option: No Questions Solved (Theory/Lecture only)
              e(
                "button",
                {
                  type: "button",
                  disabled: saving,
                  onClick: () => handleFinishAndSave(true),
                  className: "w-full py-3.5 rounded-xl bg-ink/5 hover:bg-ink/10 text-ink font-bold text-xs transition-all text-center",
                },
                "📖 No questions solved in this session (Only Theory / Lecture)"
              )
            )
          )
        )
      : null
  );
           }
