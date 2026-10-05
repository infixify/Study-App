// app/api/ai-doubt/route.ts
export const runtime = 'edge';
import { NextResponse } from "next/server";

const apiKey =
  process.env.GEMINI_API_KEY_DOUBT || process.env.GEMINI_API_KEY || "";

const MODELS_CASCADE = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
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
      generationConfig: { temperature: 0.3 },
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
You are an elite Doubt Solver Faculty for ${targetExam}, personally mentoring ${studentName}.

Student Profile:
- Target Exam: ${targetExam}
- Days to Exam: ${daysToExam ? `${daysToExam} days remaining` : "Not specified"}
- Weak Subjects: ${weakSubjects || "Not identified yet"}
- Known Mark Leaks: ${weaknesses || "Not identified yet"}
- Pending Backlogs: ${pendingBacklogs} chapters

Guidelines:
1. Address the student as ${studentName} occasionally to keep it personal.
2. Provide mathematically rigorous, step-by-step solutions.
3. Clearly state standard formulas, boundary conditions, and SI units.
4. If an alternative shortcut exists, explain it under "⚡ Exam Shortcut".
5. If the question is from a weak subject (${weakSubjects}), add extra care and reinforce the concept.
6. Keep explanations crisp, sharp and easy to read on mobile screens.
7. End with a one-line exam tip relevant to ${targetExam} when appropriate.
`;

    const fullPrompt = `
Past Conversation:
${JSON.stringify(body.conversationHistory || body.messages || [])}

Student Question:
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
