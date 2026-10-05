// app/api/ai-doubt/route.ts
export const runtime = 'edge';
import { NextResponse } from "next/server";

const apiKey =
  process.env.GEMINI_API_KEY_DOUBT || process.env.GEMINI_API_KEY || "";

// 100% Live Tested & Verified Active Models
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
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanBase64,
      },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [{ parts: parts }],
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

async function generateDoubtResponse(
  systemText: string,
  userText: string,
  key: string,
  imageBase64?: string
) {
  let lastError: any = null;
  for (const model of MODELS_CASCADE) {
    try {
      const result = await callGeminiDoubt(
        model,
        systemText,
        userText,
        key,
        imageBase64
      );
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
    const body = await req.json();

    // Universal support: query, message, prompt, or messages array
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
      return NextResponse.json(
        { error: "Gemini API key not configured on server" },
        { status: 500 }
      );
    }

    const systemInstruction = `
You are an elite Doubt Solver Faculty for JEE & NEET.
Target Subject: ${body.subject || "General Science"}
Target Exam: ${body.targetExam || "JEE / NEET"}

Guidelines:
1. Provide mathematically rigorous, step-by-step solutions.
2. Clearly state standard formulas, boundary conditions, and SI units.
3. If an alternative shortcut exists, explain it under "⚡ Exam Shortcut".
4. Keep explanations crisp, sharp and easy to read on mobile screens.
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
