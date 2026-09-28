"use client";

import { createElement as e, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface DayActivity {
  dateStr: string;
  minutes: number;
  questions: number;
  level: number; // 0: None, 1: Low, 2: Mid, 3: High, 4: Beast
}

export function ActivityHeatmap({ userId }: { userId: string }) {
  const [days, setDays] = useState<DayActivity[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivity() {
      if (!userId) return;
      try {
        const today = new Date();
        const pastDays = 84; // Last 12 weeks
        const startDate = new Date();
        startDate.setDate(today.getDate() - pastDays);

        // Fetch focus sessions
        const { data: sessions } = await supabase
          .from("focus_sessions")
          .select("started_at, duration_seconds")
          .eq("user_id", userId)
          .gte("started_at", startDate.toISOString());

        // Fetch question logs
        const { data: qLogs } = await supabase
          .from("question_logs")
          .select("log_date, question_count")
          .eq("user_id", userId)
          .gte("log_date", startDate.toISOString().split("T")[0]);

        const map: Record<string, { minutes: number; questions: number }> = {};

        (sessions || []).forEach((s) => {
          const d = s.started_at.split("T")[0];
          if (!map[d]) map[d] = { minutes: 0, questions: 0 };
          map[d].minutes += Math.round((s.duration_seconds || 0) / 60);
        });

        (qLogs || []).forEach((q) => {
          const d = q.log_date;
          if (!map[d]) map[d] = { minutes: 0, questions: 0 };
          map[d].questions += q.question_count || 0;
        });

        let sumQ = 0;
        let sumM = 0;
        const grid: DayActivity[] = [];

        for (let i = pastDays; i >= 0; i--) {
          const curr = new Date();
          curr.setDate(today.getDate() - i);
          const dStr = curr.toISOString().split("T")[0];
          const entry = map[dStr] || { minutes: 0, questions: 0 };
          sumQ += entry.questions;
          sumM += entry.minutes;

          // Intensity score
          let level = 0;
          const score = entry.minutes + entry.questions * 2;
          if (score > 180) level = 4;
          else if (score > 90) level = 3;
          else if (score > 30) level = 2;
          else if (score > 0) level = 1;

          grid.push({
            dateStr: dStr,
            minutes: entry.minutes,
            questions: entry.questions,
            level,
          });
        }

        setDays(grid);
        setTotalQuestions(sumQ);
        setTotalHours(Math.round((sumM / 60) * 10) / 10);
      } catch (err) {
        console.error("Heatmap load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [userId]);

  const levelColors = [
    "bg-ink/5 border-ink/10", // 0
    "bg-emerald-200 border-emerald-300", // 1
    "bg-emerald-400 border-emerald-500", // 2
    "bg-emerald-600 border-emerald-700", // 3
    "bg-emerald-800 border-emerald-900", // 4
  ];

  if (loading) {
    return e(
      "div",
      { className: "w-full p-5 bg-white rounded-2xl border border-ink/10 animate-pulse" },
      e("div", { className: "h-4 bg-ink/10 rounded w-1/3 mb-4" }),
      e("div", { className: "h-16 bg-ink/5 rounded-xl" })
    );
  }

  return e(
    "div",
    { className: "w-full p-5 bg-white rounded-2xl border border-ink/10 shadow-sm flex flex-col gap-4" },
    e(
      "div",
      { className: "flex items-center justify-between" },
      e(
        "div",
        null,
        e("h3", { className: "text-sm font-bold text-ink flex items-center gap-1.5" }, "Consistency Heatmap", e("span", { className: "text-xs font-normal text-slate" }, "(Last 12 Weeks)")),
        e("p", { className: "text-xs text-slate mt-0.5" }, "Daily study time & questions solved")
      ),
      e(
        "div",
        { className: "flex items-center gap-3 text-right" },
        e(
          "div",
          null,
          e("div", { className: "text-sm font-black text-emerald-600" }, totalQuestions),
          e("div", { className: "text-[10px] text-slate font-medium" }, "Questions")
        ),
        e("div", { className: "w-px h-6 bg-ink/10" }),
        e(
          "div",
          null,
          e("div", { className: "text-sm font-black text-ink" }, totalHours + "h"),
          e("div", { className: "text-[10px] text-slate font-medium" }, "Focus Time")
        )
      )
    ),

    // Heatmap Grid
    e(
      "div",
      { className: "overflow-x-auto pb-1" },
      e(
        "div",
        { className: "grid grid-rows-7 grid-flow-col gap-1.5 min-w-[280px]" },
        days.map((d) =>
          e("div", {
            key: d.dateStr,
            title: d.dateStr + ": " + d.minutes + " mins, " + d.questions + " questions",
            className: "w-3 h-3 rounded-[3px] border transition-all " + levelColors[d.level],
          })
        )
      )
    ),

    // Legend
    e(
      "div",
      { className: "flex items-center justify-between text-[11px] text-slate pt-1 border-t border-ink/5" },
      e("span", null, "Less active"),
      e(
        "div",
        { className: "flex items-center gap-1" },
        levelColors.map((c, i) =>
          e("div", { key: i, className: "w-2.5 h-2.5 rounded-[2px] border " + c })
        )
      ),
      e("span", null, "High intensity")
    )
  );
    }
