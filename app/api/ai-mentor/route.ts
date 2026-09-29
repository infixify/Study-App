// app/api/ai-mentor/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabase";

// Dedicated Key for Mentor or default
const apiKey = process.env.GEMINI_API_KEY_MENTOR || process.env.GEMINI_API_KEY || "";

// Multi-Model Cascade for 0% overload downtime
const MODELS_CASCADE = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

async function generateWithFallback(ai: GoogleGenAI, prompt: string) {
  let lastError: any = null;

  for (const model of MODELS_CASCADE) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.4,
        },
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`Model ${model} overloaded or failed, falling back to next...`, err?.message);
      lastError = err;
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  try {
    const { userId, forceRefresh } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 });
    }

    // 1. If not force refresh, check if recent report exists
    if (!forceRefresh) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("ai_mentor_report, updated_at")
        .eq("uid", userId)
        .maybeSingle();

      if (existingUser?.ai_mentor_report) {
        return NextResponse.json({ report: existingUser.ai_mentor_report, cached: true });
      }
    }

    // 2. Fetch full historical telemetry from Supabase
    const [
      { data: profile },
      { data: pastLogs },
      { data: questionLogs },
      { data: recentTests },
      { data: pendingBacklogs },
    ] = await Promise.all([
      supabase.from("users").select("*").eq("uid", userId).maybeSingle(),
      supabase
        .from("daily_logs")
        .select("study_time_minutes, theory_minutes, practice_minutes, revision_minutes, streak_count, log_date")
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
    ]);

    const targetExam = profile?.target_exam || "JEE";
    const classLevel = profile?.class_level || "12";

    const prompt = `
You are the Chief Academic Strategist for an elite coaching platform preparing students for ${targetExam}.
Analyze this student's telemetry and return a structured JSON response.

Student Context:
- Target Exam: ${targetExam}
- Class Level: ${classLevel}
- Active Pending Backlogs: ${JSON.stringify(pendingBacklogs || [])}
- Recent 14-day study logs (minutes): ${JSON.stringify(pastLogs || [])}
- Recent 14-day question solving numbers: ${JSON.stringify(questionLogs || [])}
- Last 5 Mock Test Results: ${JSON.stringify(recentTests || [])}

Required JSON Output schema strictly matching:
{
  "overall_status": "Short status (e.g. Consistent Momentum, Needs Practice Velocity, Lagging in Numericals)",
  "score_prediction": "Projected Percentile or Score Bracket (e.g. Projected: 98.2+ Percentile)",
  "diagnostic_summary": "2-3 concise, actionable sentences on what to fix today (no generic advice).",
  "today_plan": {
    "headline": "Target Tasks for Today • ${targetExam} Focus",
    "blocks": [
      {
        "tag": "High Priority",
        "subject": "Physics",
        "action": "Specific numerical problem or theory action",
        "flexiNote": "Flexible time recommendation"
      },
      {
        "tag": "Practice Sprint",
        "subject": "${targetExam.includes("NEET") ? "Biology" : "Mathematics"}",
        "action": "Specific problem solving or test action",
        "flexiNote": "Flexible time recommendation"
      },
      {
        "tag": "Retention Lock",
        "subject": "Chemistry",
        "action": "Specific NCERT recall or reaction review",
        "flexiNote": "Flexible time recommendation"
      }
    ]
  },
  "subject_analysis": [
    {
      "name": "Physics",
      "status": "e.g. Velocity Focus / Strong / Weak",
      "health": 75,
      "recommendation": "One crisp specific tip",
      "priority": "high"
    },
    {
      "name": "Chemistry",
      "status": "e.g. Reaction Retention / Formula Stable",
      "health": 80,
      "recommendation": "One crisp specific tip",
      "priority": "medium"
    },
    {
      "name": "${targetExam.includes("NEET") ? "Biology" : "Mathematics"}",
      "status": "e.g. Speed Constraint / High Accuracy",
      "health": 68,
      "recommendation": "One crisp specific tip",
      "priority": "high"
    }
  ],
  "seven_day_plan": [
    { "day": "Day 1", "focus": "Topic/Subject Focus", "target": "Specific Question & Time Target" },
    { "day": "Day 2", "focus": "Topic/Subject Focus", "target": "Specific Question & Time Target" },
    { "day": "Day 3", "focus": "Topic/Subject Focus", "target": "Specific Question & Time Target" },
    { "day": "Day 4", "focus": "Topic/Subject Focus", "target": "Specific Question & Time Target" },
    { "day": "Day 5", "focus": "Topic/Subject Focus", "target": "Specific Question & Time Target" },
    { "day": "Day 6", "focus": "Topic/Subject Focus", "target": "Specific Question & Time Target" },
    { "day": "Day 7", "focus": "Topic/Subject Focus", "target": "Specific Question & Time Target" }
  ],
  "strengths": ["Real strength 1", "Real strength 2"],
  "weaknesses": ["Real mark leak 1", "Real mark leak 2"]
}
`;

    const ai = new GoogleGenAI({ apiKey });
    const textOutput = await generateWithFallback(ai, prompt);
    const parsed = JSON.parse(textOutput);

    // Save to user profile for future fast reloads
    await supabase
      .from("users")
      .update({ ai_mentor_report: parsed })
      .eq("uid", userId);

    return NextResponse.json({ report: parsed });
  } catch (error: any) {
    console.error("AI Mentor Endpoint Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate AI mentor report" },
      { status: 500 }
    );
  }
}
