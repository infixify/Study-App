// app/api/ai-doubt/route.ts
import { NextResponse } from "next/server";

const apiKey =
  process.env.GEMINI_API_KEY_DOUBT || process.env.GEMINI_API_KEY || "";

const MODELS_CASCADE = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

async function callGeminiDoubt(model: string, systemText: string, userText: string, key: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ parts: [{ text: userText }] }],
      generationConfig: {
        temperature: 0.3,
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

async function generateDoubtResponse(systemText: string, userText: string, key: string) {
  let lastError: any = null;
  for (const model of MODELS_CASCADE) {
    try {
      const result = await callGeminiDoubt(model, systemText, userText, key);
      return result;
    } catch (err: any) {
      console.warn(`Doubt Solver: Model ${model} failed, switching to next...`, err?.message);
      lastError = err;
    }
  }
  throw lastError;
}

export async function POST(req: Request) {
  try {
    const { query, subject, targetExam, conversationHistory } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const systemInstruction = `
You are an elite Doubt Solver Faculty for JEE & NEET.
Target Subject: ${subject || "General Science"}
Target Exam: ${targetExam || "JEE / NEET"}

Guidelines:
1. Provide mathematically rigorous, step-by-step solutions.
2. Clearly state standard formulas, boundary conditions, and SI units.
3. If an alternative shortcut or elimination technique exists, explain it at the end under "⚡ Exam Shortcut".
4. Keep explanations crisp, sharp and easy to read on mobile screens.
`;

    const fullPrompt = `
Past Conversation:
${JSON.stringify(conversationHistory || [])}

Student Doubt:
${query}
`;

    const reply = await generateDoubtResponse(systemInstruction, fullPrompt, apiKey);
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("AI Doubt Endpoint Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to solve doubt" },
      { status: 500 }
    );
  }
}
