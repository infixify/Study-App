import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const apiKey = process.env.GEMINI_MENTOR_KEY || process.env.GEMINI_API_KEY || "";

export async function POST(req: Request) {
  try {
    const { userId, forceRefresh } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. SMART CACHING CHECK (If not forced, check last report from past 3 days)
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
        // If report is less than 48 hours old, return cached (0 API cost!)
        if (reportAgeHours < 48) {
          return NextResponse.json({ report: cachedReport, cached: true });
        }
      }
    }

    // 2. GATHER STUDENT'S REAL PERFORMANCE METRICS
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

    // Compute stats
    const totalStudyMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.study_time_minutes || 0), 0);
    const theoryMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.theory_minutes || 0), 0);
    const practiceMins = (recentLogs ?? []).reduce((acc, l) => acc + (l.practice_minutes || 0), 0);
    const avgDailyStudyHours = recentLogs?.length ? (totalStudyMins / recentLogs.length / 60).toFixed(1) : "0";

    const doneChapters = (chapterProgress ?? []).filter((c) => c.status === "done").length;
    const totalChapters = chapterProgress?.length || 1;

    const latestTest = testLogs?.[0] || null;
    const avgAccuracy = testLogs?.length
      ? Math.round(testLogs.reduce((acc, t) => acc + (t.accuracy || 0), 0) / testLogs.length)
      : null;

    const contextPayload = {
      studentName: profile?.name || "Aspirant",
      targetExam: profile?.target_exam || "JEE",
      targetYear: profile?.target_year || 2026,
      classLevel: profile?.class_level || "12th/Dropper",
      avgDailyStudyHours: `${avgDailyStudyHours}h/day`,
      activitySplit: {
        theoryPercentage: totalStudyMins > 0 ? Math.round((theoryMins / totalStudyMins) * 100) : 40,
        practicePercentage: totalStudyMins > 0 ? Math.round((practiceMins / totalStudyMins) * 100) : 40,
      },
      testsCount: testLogs?.length || 0,
      latestTestScore: latestTest ? `${latestTest.total_marks}/${latestTest.max_marks || 300}` : "None logged",
      averageAccuracy: avgAccuracy ? `${avgAccuracy}%` : "Not enough data",
      pendingBacklogsCount: backlogs?.length || 0,
      pendingBacklogsSample: (backlogs ?? []).slice(0, 4).map((b) => b.title),
      syllabusDoneCount: doneChapters,
    };

    // 3. GENERATE WITH GEMINI OR SMART FALLBACK
    let aiReportData: any = null;

    if (apiKey) {
      try {
        const prompt = `
You are the Head Academic Mentor & Top Rank Coach at a premier coaching institute (Allen/Kota) mentoring a ${contextPayload.targetExam} ${contextPayload.targetYear} aspirant named ${contextPayload.studentName}.

Analyze this real student telemetry:
${JSON.stringify(contextPayload, null, 2)}

Provide an honest, highly actionable, strategic diagnostic and 7-day turnaround plan. Be encouraging but direct if they are lacking question practice or piling backlogs.

Return ONLY a valid JSON object matching this schema:
{
  "overall_status": "On Track" | "Needs Attention" | "Critical Backlog",
  "score_prediction": "Short 1-line expected percentile or rank readiness (e.g. 'Projected Mains: 96.5 - 98.2 %ile with current trajectory')",
  "strengths": ["string", "string"],
  "weaknesses": ["string", "string"],
  "diagnostic_summary": "2-3 paragraphs analyzing their study balance (theory vs practice), backlog burden, and test temperament.",
  "seven_day_plan": [
    {"day": "Day 1-2", "focus": "string", "target": "string"},
    {"day": "Day 3-4", "focus": "string", "target": "string"},
    {"day": "Day 5-6", "focus": "string", "target": "string"},
    {"day": "Day 7", "focus": "Full Mock & Review", "target": "string"}
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
          if (rawText) {
            aiReportData = JSON.parse(rawText);
          }
        } else {
          console.warn("Gemini API returned error, falling back to rule engine:", response.statusText);
        }
      } catch (geminiError) {
        console.error("Gemini invocation failed:", geminiError);
      }
    }

    // 4. INTELLIGENT RULE-BASED FALLBACK (Guarantees 0% failure if Gemini is rate-limited)
    if (!aiReportData) {
      const isBacklogHeavy = (backlogs?.length || 0) >= 3;
      const isPracticeLow = contextPayload.activitySplit.practicePercentage < 35;
      const status = isBacklogHeavy ? "Critical Backlog" : isPracticeLow ? "Needs Attention" : "On Track";

      aiReportData = {
        overall_status: status,
        score_prediction:
          avgAccuracy && avgAccuracy > 70
            ? `Projected ${contextPayload.targetExam}: 97.0 - 98.5 %ile (High potential)`
            : `Projected ${contextPayload.targetExam}: 92.0 - 95.0 %ile (Needs practice push)`,
        strengths: [
          `Consistent daily logging with ${avgDailyStudyHours}h average study`,
          doneChapters > 10 ? `Completed ${doneChapters} chapters in syllabus` : "Active participation across subjects",
        ],
        weaknesses: [
          isPracticeLow ? "Low question practice ratio (< 40%). Too much passive video watching." : "Mock test frequency needs to increase.",
          isBacklogHeavy ? `${backlogs?.length} pending backlog items accumulating pressure.` : "Focus on negative marking reduction.",
        ],
        diagnostic_summary: `Your current study distribution shows you are dedicating time, but ${
          isPracticeLow ? "the ratio of self-practice to theory is skewed toward lectures. Competitive exams are cleared by solving 80-100 questions daily, not just re-watching concepts." : "you have a healthy balance of study."
        } ${
          isBacklogHeavy
            ? `You have ${backlogs?.length} unresolved backlogs. Allocate the first 90 minutes of your daily study block solely to clear these pending topics.`
            : "Keep your momentum steady and analyze every wrong answer in your mocks."
        }`,
        seven_day_plan: [
          { day: "Day 1-2", focus: "Backlog Clearance", target: "Complete pending DPPs and formulas for 2 backlog topics" },
          { day: "Day 3-4", focus: "High-Yield Practice", target: "Solve 60 PYQs (Past 5 Years) from your strongest subject" },
          { day: "Day 5-6", focus: "Weak Subject Drills", target: "Timed 45-minute question blitz on error areas" },
          { day: "Day 7", focus: "Full Mock Test", target: "Take a 3-hour proctored mock & write an error log analysis" },
        ],
        action_tips: [
          "Maintain a 1:2 Theory to Practice ratio (1 hour video = 2 hours solving).",
          "Never skip writing wrong questions in an error notebook after mocks.",
          "Clear backlogs in morning 90-minute strict focus blocks.",
        ],
      };
    }

    // 5. SAVE TO SUPABASE (Cached for future 0-cost loads)
    const { data: savedReport, error: saveErr } = await supabase
      .from("ai_mentor_reports")
      .insert({
        user_id: userId,
        overall_status: aiReportData.overall_status,
        score_prediction: aiReportData.score_prediction,
        strengths: aiReportData.strengths,
        weaknesses: aiReportData.weaknesses,
        diagnostic_summary: aiReportData.diagnostic_summary,
        seven_day_plan: aiReportData.seven_day_plan,
        action_tips: aiReportData.action_tips,
      })
      .select()
      .single();

    return NextResponse.json({
      report: savedReport || aiReportData,
      cached: false,
    });
  } catch (err: any) {
    console.error("AI mentor endpoint error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
                 }
