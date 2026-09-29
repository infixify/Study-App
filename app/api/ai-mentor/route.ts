// app/api/ai-mentor/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const apiKey =
  process.env.GEMINI_API_KEY_MENTOR || process.env.GEMINI_API_KEY || "";

const MODELS_CASCADE = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
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
      const result = await callGeminiApi(model, prompt, key);
      return result;
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
        .select("test_name, marks_scored, max_marks, accuracy, test_date")
        .eq("user_id", userId)
        .order("test_date", { ascending: false })
        .limit(5),
      supabase
        .from("chapter_progress")
        .select("chapter_id, status")
        .eq("user_id", userId)
        .eq("is_backlog", true),
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
      "status": "Velocity Focus / Strong / Weak",
      "health": 75,
      "recommendation": "One crisp specific tip",
      "priority": "high"
    },
    {
      "name": "Chemistry",
      "status": "Reaction Retention / Formula Stable",
      "health": 80,
      "recommendation": "One crisp specific tip",
      "priority": "medium"
    },
    {
      "name": "${targetExam.includes("NEET") ? "Biology" : "Mathematics"}",
      "status": "Speed Constraint / High Accuracy",
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

    const rawJson = await generateWithFallback(prompt, apiKey);
    const parsed = JSON.parse(rawJson);

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
