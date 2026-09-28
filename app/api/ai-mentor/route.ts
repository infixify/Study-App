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

    // 2. FETCH REAL TELEMETRY
    const [
      { data: profile },
      { data: recentLogs },
      { data: testLogs },
      { data: backlogs },
      { data: chapterProgress },
    ] = await Promise.all([
      supabase.from("users").select("name, target_exam, target_year, class_level").eq("uid", userId).maybeSingle(),
      supabase.from("daily_logs").select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes").eq("user_id", userId).limit(14),
      supabase.from("test_logs").select("test_name, total_marks, max_marks, accuracy, physics_marks, chemistry_marks, maths_marks, test_date").eq("user_id", userId).order("test_date", { ascending: false }).limit(6),
      supabase.from("tasks").select("title, priority").eq("user_id", userId).eq("task_type", "backlog").neq("status", "completed"),
      supabase.from("chapter_progress").select("status").eq("user_id", userId),
    ]);

    const totalStudyMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.study_time_minutes || 0), 0);
    const theoryMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.theory_minutes || 0), 0);
    const practiceMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.practice_minutes || 0), 0);
    const avgDailyHours = recentLogs?.length ? (totalStudyMins / recentLogs.length / 60).toFixed(1) : "0";

    const doneChapters = (chapterProgress ?? []).filter((c) => c.status === "done").length;
    const isNewUser = (recentLogs?.length || 0) === 0 && (testLogs?.length || 0) === 0;

    let aiReportData: any = null;

    if (apiKey) {
      try {
        const prompt = `
You are the Head Academic Director & Super-30/Kota Mentor at an elite institute. Mentoring student: ${profile?.name || "Aspirant"}, preparing for ${profile?.target_exam || "JEE"} ${profile?.target_year || 2027}.

Telemetry Data:
- Is New User / Fresh Profile: ${isNewUser}
- Total Logged Study Time: ${avgDailyHours} hours/day average
- Theory to Practice Ratio: ${theoryMins}m theory vs ${practiceMins}m question practice
- Mock Tests Logged: ${testLogs?.length || 0} tests
- Latest Mock Result: ${testLogs?.[0] ? `${testLogs[0].total_marks}/${testLogs[0].max_marks} (Acc: ${testLogs[0].accuracy}%)` : "No mocks taken yet"}
- Unresolved Backlogs: ${backlogs?.length || 0} (${(backlogs ?? []).map((b) => b.title).join(", ")})
- Syllabus Progress: ${doneChapters} chapters completed

Task:
${isNewUser ? "The student just joined and has not logged study sessions or mocks yet. Provide a rigorous, inspiring 'Day 1 Launch Diagnostic' tailored to their target exam and year, explaining the mandatory daily study splits and how to avoid early backlogs." : "Analyze their study split, mock scores, and backlog count with deep personalization."}

Return ONLY this JSON schema:
{
  "overall_status": "${isNewUser ? "Kickstart Phase" : backlogs?.length ? "Needs Attention" : "On Track"}",
  "score_prediction": "${profile?.target_exam || "JEE"} ${profile?.target_year || 2027} Benchmark: Target 99+ %ile",
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "diagnostic_summary": "Deep paragraph addressing ${profile?.name || "the student"} directly by name, analyzing their exact numbers.",
  "seven_day_plan": [
    {"day": "Day 1-2", "focus": "string", "target": "string"},
    {"day": "Day 3-4", "focus": "string", "target": "string"},
    {"day": "Day 5-6", "focus": "string", "target": "string"},
    {"day": "Day 7", "focus": "Weekly Revision & Mock", "target": "string"}
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

    // Intelligent Fallback (Tailored for New or Active Students)
    if (!aiReportData) {
      if (isNewUser) {
        aiReportData = {
          overall_status: "Kickstart Phase",
          score_prediction: `Targeting ${profile?.target_exam || "JEE"} ${profile?.target_year || 2027}: Path to 99+ %ile`,
          strengths: [
            "Early preparation start gives you massive leverage over the competition.",
            "Fresh dashboard ready for disciplined tracking from Day 1.",
          ],
          weaknesses: [
            "Zero study hours logged yet — momentum needs to start today.",
            "No diagnostic mock score recorded yet.",
          ],
          diagnostic_summary: `Welcome Sarthak! Right now, your dashboard has a clean slate. To reach the top 1% in ${profile?.target_exam || "JEE"} ${profile?.target_year || 2027}, Kota's rule is non-negotiable: for every 1 hour of lecture, you must solve questions for 2 hours. Start by logging your first 60-minute study session in the Study tab and record your chapter test scores!`,
          seven_day_plan: [
            { day: "Day 1-2", focus: "Foundation & Baseline", target: "Log minimum 4 hours of focused study with 40 questions solved" },
            { day: "Day 3-4", focus: "Active Question Solving", target: "Dedicate 2 hours exclusively to DPPs without touching solution sheets" },
            { day: "Day 5-6", focus: "Concept Consolidation", target: "Make 1-page formula short notes for your current running chapters" },
            { day: "Day 7", focus: "Diagnostic Test", target: "Log your first 25-question chapter test in the Test tab" },
          ],
          action_tips: [
            "Use the Study tab stopwatch/timer for every study block to build genuine focus.",
            "Never let a pending homework DPP slide into a backlog.",
            "Review your formula sheets every night for 15 minutes before sleeping.",
          ],
        };
      } else {
        aiReportData = {
          overall_status: backlogs?.length ? "Needs Attention" : "On Track",
          score_prediction: `Projected ${profile?.target_exam || "JEE"}: 94.0 - 96.5 %ile (Needs Question Practice)`,
          strengths: [
            `Logged ${avgDailyHours} hours of average study across sessions.`,
            doneChapters > 0 ? `${doneChapters} chapters completed in syllabus.` : "Consistent daily check-ins.",
          ],
          weaknesses: [
            practiceMins < theoryMins ? "More time spent watching theory than solving questions." : "Need higher mock frequency.",
            backlogs?.length ? `${backlogs.length} pending backlogs waiting to be resolved.` : "Speed per question needs improvement.",
          ],
          diagnostic_summary: `Sarthak, your daily tracking shows initial consistency, but competitive exams are won by problem-solving volume. Shift your daily allocation to at least 65% practice. Clear pending backlogs in the morning before starting new lectures.`,
          seven_day_plan: [
            { day: "Day 1-2", focus: "Clear Pending Backlog", target: "Finish pending DPPs in your Backlog Tracker" },
            { day: "Day 3-4", focus: "PYQ Drill", target: "Solve 50 previous year questions from high-weightage chapters" },
            { day: "Day 5-6", focus: "Timed Solving", target: "Solve 30 questions in 60 minutes strictly under a timer" },
            { day: "Day 7", focus: "Mock Test", target: "Take a full test and log your accuracy" },
          ],
          action_tips: [
            "Maintain a strict 1:2 Theory to Practice ratio.",
            "Mark all unsolved DPP questions directly in your Backlog Tracker.",
            "Revise error notebook questions weekly.",
          ],
        };
      }
    }

    // Save to cache
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
