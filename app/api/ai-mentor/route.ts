// app/api/ai-mentor/route.ts
export const runtime = 'edge';
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const apiKey =
  process.env.GEMINI_API_KEY_MENTOR || process.env.GEMINI_API_KEY || "";

const MODELS_CASCADE = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
];

async function callGeminiApi(model: string, prompt: string, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Model ${model} returned ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Model ${model} gave empty response`);
  return text;
}

async function generateWithFallback(prompt: string, key: string) {
  let lastError: any = null;
  for (const model of MODELS_CASCADE) {
    try {
      return await callGeminiApi(model, prompt, key);
    } catch (err: any) {
      console.warn(`Model ${model} failed, falling back...`, err?.message);
      lastError = err;
    }
  }
  throw lastError;
}

// Compute actual Q/hr from question_logs
function computeQuestionsPerHour(questionLogs: any[], studyLogs: any[]): number | null {
  const totalQuestions = questionLogs?.reduce((sum: number, l: any) => sum + (l.question_count || 0), 0) ?? 0;
  const totalStudyHours = studyLogs?.reduce((sum: number, l: any) => sum + (l.study_time_minutes || 0), 0) / 60 ?? 0;
  if (totalStudyHours < 1 || totalQuestions === 0) return null;
  return Math.round(totalQuestions / totalStudyHours);
}

// Compute practice vs theory ratio from daily_logs
function computePracticeRatio(studyLogs: any[]): number | null {
  const totalStudy = studyLogs?.reduce((sum: number, l: any) => sum + (l.study_time_minutes || 0), 0) ?? 0;
  const totalPractice = studyLogs?.reduce((sum: number, l: any) => sum + (l.practice_minutes || 0), 0) ?? 0;
  if (totalStudy === 0) return null;
  return Math.round((totalPractice / totalStudy) * 100);
}

export async function POST(req: Request) {
  try {
    const { userId, forceRefresh } = await req.json();
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    if (!apiKey) return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });

    if (!forceRefresh) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("ai_mentor_report")
        .eq("uid", userId)
        .maybeSingle();

      if (existingUser?.ai_mentor_report) {
        return NextResponse.json({ report: existingUser.ai_mentor_report, cached: true });
      }
    }

    // Fetch profile first so target_exam is available for exam schedule query
    const { data: profile } = await supabase.from("users").select("*").eq("uid", userId).maybeSingle();

    const targetExamForQuery = profile?.target_exam || "JEE";

    const [
      { data: pastLogs },
      { data: questionLogs },
      { data: recentTests },
      { data: pendingBacklogs },
      { data: subjectSessions },
      { data: chapterProgress },
      { data: questionDetails },
      { data: upcomingExam },
    ] = await Promise.all([
      supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, verified_minutes, streak_count, log_date")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(14),
      supabase
        .from("question_logs")
        .select("question_count, log_date")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(14),
      supabase
        .from("test_logs")
        .select("test_name, total_marks, max_marks, accuracy, test_date")
        .eq("user_id", userId)
        .order("test_date", { ascending: false })
        .limit(5),
      supabase
        .from("tasks")
        .select("title, priority, due_date")
        .eq("user_id", userId)
        .eq("task_type", "backlog")
        .neq("status", "completed"),
      supabase
        .from("focus_sessions")
        .select("subject, duration_seconds, started_at")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(30),
      supabase
        .from("chapter_progress")
        .select("status, is_backlog, chapter_id, chapters(title, subject_id, subjects(name))")
        .eq("user_id", userId),
      supabase
        .from("question_logs")
        .select("question_count, log_date, topic_name, start_from, end_on, subject_id, chapter_id, subjects(name), chapters(title)")
        .eq("user_id", userId)
        .order("log_date", { ascending: false })
        .limit(30),
      supabase
        .from("exam_schedules")
        .select("exam_date, label")
        .eq("target_exam", targetExamForQuery)
        .gte("exam_date", new Date().toISOString().split("T")[0])
        .order("exam_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const targetExam = targetExamForQuery;
    const classLevel = profile?.class_level || "12";
    const studentName = profile?.name || "Student";

    // Compute real metrics
    const actualQph = computeQuestionsPerHour(questionLogs || [], pastLogs || []);
    const actualPracticeRatio = computePracticeRatio(pastLogs || []);

    // Days remaining to exam
    let daysToExam: number | null = null;
    let examLabel: string | null = null;
    if (upcomingExam?.exam_date) {
      const examDate = new Date(upcomingExam.exam_date);
      const today = new Date();
      daysToExam = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      examLabel = upcomingExam.label;
    }

    const prompt = `
You are the Chief Academic Strategist for an elite coaching platform preparing students for ${targetExam}.
Analyze this student's telemetry and return a structured JSON response.

Student Context:
- Name: ${studentName}
- Target Exam: ${targetExam}
- Class Level: ${classLevel}
- Days Remaining to Exam: ${daysToExam !== null ? `${daysToExam} days (${examLabel})` : "Exam date not set"}
- Active Pending Backlogs: ${JSON.stringify(pendingBacklogs || [])}
- Recent 14-day study logs (theory_minutes, practice_minutes, revision_minutes, verified_minutes = time with face-cam + app-blocker ON): ${JSON.stringify(pastLogs || [])}
- Recent 14-day question solving numbers: ${JSON.stringify(questionLogs || [])}
- Computed Actual Q/hr Pace: ${actualQph !== null ? `${actualQph} questions/hour` : "Not enough data yet"}
- Computed Actual Practice Ratio: ${actualPracticeRatio !== null ? `${actualPracticeRatio}% of study time is practice` : "Not enough data yet"}
- Last 5 Mock Test Results: ${JSON.stringify(recentTests || [])}
- Subject-wise study time (last 30 sessions): ${JSON.stringify(subjectSessions || [])}
- Chapter progress (done/pending/backlog): ${JSON.stringify(chapterProgress || [])}
- Detailed question solving log (last 30 entries): ${JSON.stringify(questionDetails || [])}

Based on actual computed Q/hr (${actualQph ?? "unknown"}) and practice ratio (${actualPracticeRatio ?? "unknown"}%), generate REAL targets:
- pace_target_qph: A specific achievable target slightly above their current pace (or 20 if no data)
- practice_ratio_target: A specific target ratio to aim for (or 60 if no data)

Required JSON Output (strict schema):
{
  "overall_status": "Short status",
  "score_prediction": "Projected Percentile or Score Bracket",
  "diagnostic_summary": "2-3 concise actionable sentences based on real data.",
  "pace_target_qph": 25,
  "practice_ratio_target": 65,
  "today_plan": {
    "headline": "Target Tasks for Today • ${targetExam} Focus",
    "blocks": [
      { "tag": "High Priority", "subject": "Physics", "action": "Specific action", "flexiNote": "Time note" },
      { "tag": "Practice Sprint", "subject": "${targetExam.includes("NEET") ? "Biology" : "Mathematics"}", "action": "Specific action", "flexiNote": "Time note" },
      { "tag": "Retention Lock", "subject": "Chemistry", "action": "Specific action", "flexiNote": "Time note" }
    ]
  },
  "subject_analysis": [
    { "name": "Physics", "status": "Status", "health": 75, "recommendation": "Crisp tip", "priority": "high" },
    { "name": "Chemistry", "status": "Status", "health": 80, "recommendation": "Crisp tip", "priority": "medium" },
    { "name": "${targetExam.includes("NEET") ? "Biology" : "Mathematics"}", "status": "Status", "health": 68, "recommendation": "Crisp tip", "priority": "high" }
  ],
  "seven_day_plan": [
    { "day": "Day 1", "focus": "Topic Focus", "target": "Specific Q & Time Target" },
    { "day": "Day 2", "focus": "Topic Focus", "target": "Specific Q & Time Target" },
    { "day": "Day 3", "focus": "Topic Focus", "target": "Specific Q & Time Target" },
    { "day": "Day 4", "focus": "Topic Focus", "target": "Specific Q & Time Target" },
    { "day": "Day 5", "focus": "Topic Focus", "target": "Specific Q & Time Target" },
    { "day": "Day 6", "focus": "Topic Focus", "target": "Specific Q & Time Target" },
    { "day": "Day 7", "focus": "Topic Focus", "target": "Specific Q & Time Target" }
  ],
  "strengths": ["Real strength 1", "Real strength 2"],
  "weaknesses": ["Real mark leak 1", "Real mark leak 2"]
}
`;

    const rawJson = await generateWithFallback(prompt, apiKey);
    const cleaned = rawJson.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Store student context for doubt solver (lightweight, no large arrays)
    const studentContext = {
      name: studentName,
      targetExam,
      classLevel,
      daysToExam,
      examLabel,
      weakSubjects: parsed.subject_analysis
        ?.filter((s: any) => s.priority === "high")
        ?.map((s: any) => s.name) || [],
      weaknesses: parsed.weaknesses || [],
      pendingBacklogCount: pendingBacklogs?.length || 0,
    };

    await supabase
      .from("users")
      .update({ ai_mentor_report: parsed, ai_student_context: studentContext })
      .eq("uid", userId);

    return NextResponse.json({ report: parsed, studentContext });
  } catch (error: any) {
    console.error("AI Mentor Endpoint Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate AI mentor report" },
      { status: 500 }
    );
  }
}
