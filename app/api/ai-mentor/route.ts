// app/api/ai-mentor/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const apiKey = process.env.GEMINI_MENTOR_KEY || process.env.GEMINI_API_KEY || "";

export async function POST(req: Request) {
  try {
    const { userId, forceRefresh } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. CACHE CHECK (Past 48h)
    if (!forceRefresh) {
      const { data: cachedReport } = await supabase
        .from("ai_mentor_reports")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedReport) {
        const reportAgeHours = (Date.now() - new Date(cachedReport.created_at).getTime()) / (1000 * 60 * 60);
        if (reportAgeHours < 48) {
          return NextResponse.json({ report: cachedReport, cached: true });
        }
      }
    }

    // 2. FETCH REAL STUDENT TELEMETRY
    const [
      { data: profile },
      { data: recentLogs },
      { data: testLogs },
      { data: backlogs },
      { data: chapterProgress },
    ] = await Promise.all([
      supabase.from("users").select("name, target_exam, target_year, class_level").eq("uid", userId).maybeSingle(),
      supabase.from("daily_logs").select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, streak_count").eq("user_id", userId).limit(14),
      supabase.from("test_logs").select("test_name, total_marks, max_marks, accuracy, physics_marks, chemistry_marks, maths_marks, test_date").eq("user_id", userId).order("test_date", { ascending: false }).limit(6),
      supabase.from("tasks").select("title, priority").eq("user_id", userId).eq("task_type", "backlog").neq("status", "completed"),
      supabase.from("chapter_progress").select("status").eq("user_id", userId),
    ]);

    const totalStudyMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.study_time_minutes || 0), 0);
    const theoryMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.theory_minutes || 0), 0);
    const practiceMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.practice_minutes || 0), 0);
    const revisionMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.revision_minutes || 0), 0);
    const avgDailyHours = recentLogs?.length ? (totalStudyMins / recentLogs.length / 60).toFixed(1) : "0";

    const doneChapters = (chapterProgress ?? []).filter((c) => c.status === "done").length;
    const isNewUser = (recentLogs?.length || 0) === 0 && (testLogs?.length || 0) === 0;

    // JEETrack Efficiency Metric: Practice to Theory Ratio (Optimal is >= 1.5)
    const ptRatio = theoryMins > 0 ? (practiceMins / theoryMins).toFixed(2) : practiceMins > 0 ? "2.0" : "0.0";

    // Latest Test Breakdown
    const latestTest = testLogs?.[0] || null;
    const avgAccuracy = testLogs?.length
      ? Math.round(testLogs.reduce((acc, t) => acc + (t.accuracy || 0), 0) / testLogs.length)
      : null;

    let aiReportData: any = null;

    if (apiKey) {
      try {
        const prompt = `
You are the Chief Academic Director at a Top 100 AIR JEE/NEET Coaching Institute in Kota (think Allen/Resonance HOD).
You are conducting a strict, data-driven academic review for: ${profile?.name || "Aspirant"}.
Target Exam: ${profile?.target_exam || "JEE"} ${profile?.target_year || 2027} (${profile?.class_level || "11th/12th"}).

TELEMETRY AUDIT:
- Account Status: ${isNewUser ? "Brand New (0 logs recorded yet)" : "Active Student"}
- Average Logged Study: ${avgDailyHours} hours/day
- Practice to Theory (P:T) Ratio: ${ptRatio} (Standard: 1.5 minimum required)
- Time Distribution: ${theoryMins}m Theory vs ${practiceMins}m Practice vs ${revisionMins}m Revision
- Test History: ${testLogs?.length || 0} mock tests logged
- Latest Test Score: ${latestTest ? `${latestTest.total_marks}/${latestTest.max_marks} (Acc: ${latestTest.accuracy}%)` : "No test records"}
- Pending Backlogs: ${backlogs?.length || 0} unresolved (${(backlogs ?? []).map((b) => b.title).join(", ")})
- Syllabus Completion: ${doneChapters} chapters completed

INSTRUCTIONS FOR KOTA MENTOR TONE:
1. Speak directly to ${profile?.name || "the student"}. Be sharp, realistic, analytical, and highly motivating.
2. If new user: Give a rigorous 'Kota Day 1 Protocol' (why 99% of students fail by watching too many lectures and not solving questions, and how to build a 6-hour baseline).
3. If active user: Analyze their P:T ratio, point out subject weaknesses or backlog compounding risks, and give exact remedial targets.
4. Provide an exact 7-Day Execution Blueprint with daily hour targets.

Return ONLY a valid JSON object matching this schema:
{
  "overall_status": "${isNewUser ? "Kickstart Phase" : backlogs?.length ? "Needs Attention" : "On Track"}",
  "score_prediction": "Short 1-line benchmark (e.g. 'Projected AIR Potential: Top 1.5% with current pace')",
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "diagnostic_summary": "Comprehensive 2-3 paragraph Kota HOD review dissecting their study efficiency, backlog weight, and strategic recommendations.",
  "seven_day_plan": [
    {"day": "Day 1-2", "focus": "string", "target": "string"},
    {"day": "Day 3-4", "focus": "string", "target": "string"},
    {"day": "Day 5-6", "focus": "string", "target": "string"},
    {"day": "Day 7", "focus": "string", "target": "string"}
  ],
  "action_tips": ["string", "string", "string"]
}
`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { response_mime_type: "application/json" },
            }),
          }
        );

        if (response.ok) {
          const resJson = await response.json();
          const rawText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) aiReportData = JSON.parse(rawText);
        }
      } catch (e) {
        console.error("Gemini failed:", e);
      }
    }

    // JEETrack Kota Fallback Engine (Zero generic text!)
    if (!aiReportData) {
      if (isNewUser) {
        aiReportData = {
          overall_status: "Kickstart Phase",
          score_prediction: `Targeting ${profile?.target_exam || "JEE"} ${profile?.target_year || 2027} • Target: 99.2+ Percentile`,
          strengths: [
            "Early onboarding gives you a massive 8-month strategic buffer over competitors.",
            "Fresh system ready to establish a rigid 1:1.5 Theory-to-Practice routine from Day 1.",
          ],
          weaknesses: [
            "No active study logs recorded yet. Consistency must be established immediately.",
            "No diagnostic test on record to gauge subject baseline.",
          ],
          diagnostic_summary: `Listen carefully, ${profile?.name || "Aspirant"}: The single biggest reason 95% of ${profile?.target_exam || "JEE"} students fail isn't lack of intelligence — it's the 'Passive Video Trap'. They spend 6 hours watching YouTube/coaching lectures and 30 minutes solving questions. In the real exam, no one asks you to explain theory; you must solve numericals in under 2.5 minutes.\n\nFrom today, your non-negotiable rule is the Kota 1:1.5 Rule: For every 60 minutes of lecture you attend, you MUST solve DPPs and PYQs for at least 90 minutes. Turn on your timer in the Study tab and log your first 2-hour problem block today!`,
          seven_day_plan: [
            { day: "Day 1-2", focus: "Baseline Setup & Focus Test", target: "Log 4 hours of pure study with 45 numericals solved across Physics & Maths" },
            { day: "Day 3-4", focus: "Self-Solving Discipline", target: "Solve 30 DPP questions strictly without opening hints or video solutions" },
            { day: "Day 5-6", focus: "Backlog Defense & Formulas", target: "Create 1-page condensed formula sheets for current running topics" },
            { day: "Day 7", focus: "First Diagnostic Mock", target: "Attempt a 1-hour chapter test and log accuracy in the Test tab" },
          ],
          action_tips: [
            "Never open solution PDFs before attempting a question at least 3 times.",
            "Condition your brain: Study in 90-minute uninterrupted slots with phone on airplane mode.",
            "Keep an Error Log: Every silly mistake in mock tests must be written in a physical notebook.",
          ],
        };
      } else {
        const isLowPractice = Number(ptRatio) < 1.0;
        const hasBacklogs = (backlogs?.length || 0) > 0;

        aiReportData = {
          overall_status: hasBacklogs ? "Needs Attention" : "On Track",
          score_prediction: `Current Projected Trajectory: ~${avgAccuracy ? Math.min(99, Math.max(90, Math.round(avgAccuracy * 1.1))) : 94.5} %ile`,
          strengths: [
            `Demonstrated study habit with ${avgDailyHours}h daily average.`,
            doneChapters > 0 ? `${doneChapters} chapters completed in target syllabus.` : "Consistent daily tracking check-ins.",
          ],
          weaknesses: [
            isLowPractice ? `Severe Theory Imbalance (P:T Ratio is ${ptRatio}). You are spending too much time passively watching.` : "Speed per question needs optimization.",
            hasBacklogs ? `${backlogs.length} pending backlog items accumulating psychological burden.` : "Negative marking control required.",
          ],
          diagnostic_summary: `${profile?.name || "Aspirant"}, your study logs reveal that ${isLowPractice ? `your Practice-to-Theory ratio is ${ptRatio}. Top rankers maintain a ratio of 1.5 to 2.0. You must stop over-consuming lectures and start fighting with numericals directly.` : "you are putting in sincere effort."} ${hasBacklogs ? `Your ${backlogs.length} pending backlogs are a compounding liability. Clear them in the 6:30 AM morning slot before starting your regular coaching lectures.` : "Keep your momentum steady and analyze your mock errors."}`,
          seven_day_plan: [
            { day: "Day 1-2", focus: "Aggressive Backlog Blitz", target: "Clear 2 pending backlog topics in high-priority morning blocks" },
            { day: "Day 3-4", focus: "Timed PYQ Sprints", target: "Solve 50 previous year questions with 2.5 min/question stopwatch limit" },
            { day: "Day 5-6", focus: "Weak Subject Reinforcement", target: "Target your lowest accuracy subject with 40 direct problem solves" },
            { day: "Day 7", focus: "Full Proctored Mock Test", target: "Take a full 3-hour test, log marks in Test Hub, and review errors" },
          ],
          action_tips: [
            "Maintain a strict 1:1.5 Theory-to-Practice ratio every single day.",
            "Clear backlogs in the morning; never let them spill into the next week.",
            "Review your formula sheets every night for 15 minutes before sleeping.",
          ],
        };
      }
    }

    // Save to cache in DB
    await supabase.from("ai_mentor_reports").insert({
      user_id: userId,
      overall_status: aiReportData.overall_status,
      score_prediction: aiReportData.score_prediction,
      strengths: aiReportData.strengths,
      weaknesses: aiReportData.weaknesses,
      diagnostic_summary: aiReportData.diagnostic_summary,
      seven_day_plan: aiReportData.seven_day_plan,
      action_tips: aiReportData.action_tips,
    });

    return NextResponse.json({ report: aiReportData, cached: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
