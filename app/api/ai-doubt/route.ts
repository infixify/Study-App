// app/api/ai-doubt/route.ts
export const runtime = 'edge';
import { NextResponse } from "next/server";

// Prioritizes separate Doubt Solver API Key
const apiKey =
  process.env.GEMINI_API_KEY_DOUBT || process.env.GEMINI_API_KEY || "";

const MODELS_CASCADE = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.0-flash-lite-preview-02-05",
];

async function callGeminiDoubt(
  model: string,
  systemText: string,
  userText: string,
  key: string,
  imageBase64?: string
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const parts: any[] = [{ text: userText }];

  if (imageBase64) {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    parts.unshift({
      inlineData: { mimeType: "image/jpeg", data: cleanBase64 },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ parts }],
      generationConfig: { temperature: 0.2 },
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

async function generateDoubtResponse(
  systemText: string,
  userText: string,
  key: string,
  imageBase64?: string
) {
  let lastError: any = null;
  for (const model of MODELS_CASCADE) {
    try {
      return await callGeminiDoubt(model, systemText, userText, key, imageBase64);
    } catch (err: any) {
      console.warn(`Doubt Solver: Model ${model} failed, switching...`, err?.message);
      lastError = err;
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    let studentQuestion =
      body.query ||
      body.message ||
      body.prompt ||
      (Array.isArray(body.messages)
        ? body.messages[body.messages.length - 1]?.content
        : "");

    if (!studentQuestion && !body.image && !body.imageBase64) {
      return NextResponse.json({ error: "Missing question query" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "Gemini API key not configured on server" }, { status: 500 });
    }

    // Build personalized system instruction using studentContext
    const ctx = body.studentContext;
    const targetExam = ctx?.targetExam || body.targetExam || "JEE / NEET";
    const studentName = ctx?.name || "Student";
    const daysToExam = ctx?.daysToExam;
    const weakSubjects = ctx?.weakSubjects?.join(", ") || "";
    const weaknesses = ctx?.weaknesses?.join(", ") || "";
    const pendingBacklogs = ctx?.pendingBacklogCount || 0;

    const systemInstruction = `
You are an elite, energetic, highly encouraging AI Faculty & Doubt Mentor for ${targetExam}, mentoring ${studentName}.

Student Context:
- Target Exam: ${targetExam}
- Days Remaining: ${daysToExam ? `${daysToExam} days` : "Not specified"}
- Weak Subjects: ${weakSubjects || "General"}
- Known Weaknesses: ${weaknesses || "None"}
- Backlogs: ${pendingBacklogs} chapters

CRITICAL QUALITY CHECK RULE:
If the attached image is blurry, too dark, rotated, partially cut off, or the complete question/diagram/options cannot be clearly read with 100% certainty:
DO NOT guess or hallucinate any answer.
Immediately and warmly tell ${studentName} in friendly Hinglish:
"Bhai ${studentName}, ye photo thodi blurry ya aadhi cut gayi hai. Kripya question aur options ko camera box ke andar seedha rakh kar dubara snap lein taaki main accurate solution de sakun!"
Explicitly state what is missing (e.g. "Options cut gaye hain" or "Diagram ki values saaf nahi dikh rahi").

NORMAL TEACHING GUIDELINES:
1. Address ${studentName} naturally like a friendly top-ranker mentor.
2. Provide step-by-step rigorous logical explanations with formulas and SI units clearly stated.
3. If an alternative shortcut or elimination trick exists, put it under "⚡ Exam Shortcut".
4. Keep the explanation engaging, conversational and easy to read. This explanation will also be read aloud to the student, so avoid overly complicated ASCII tables.
5. End with a 1-line motivating pro-tip for ${targetExam}.
`;

    const fullPrompt = `
Conversation History:
${JSON.stringify(body.conversationHistory || body.messages || [])}

Student Voice / Question:
${studentQuestion || "Solve the attached image question step-by-step."}
`;

    const reply = await generateDoubtResponse(
      systemInstruction,
      fullPrompt,
      apiKey,
      body.image || body.imageBase64
    );

    return NextResponse.json({ reply, text: reply, content: reply });
  } catch (error: any) {
    console.error("AI Doubt Endpoint Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to solve doubt" },
      { status: 500 }
    );
  }
}
