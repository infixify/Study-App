// app/api/ai-doubt/route.ts
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Dedicated Key for Doubt Solver or default
const apiKey = process.env.GEMINI_API_KEY_DOUBT || process.env.GEMINI_API_KEY || "";

const MODELS_CASCADE = [
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
];

async function generateDoubtResponse(ai: GoogleGenAI, systemInstruction: string, prompt: string) {
  let lastError: any = null;

  for (const model of MODELS_CASCADE) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.3, // low temperature for precise mathematical/scientific accuracy
        },
      });
      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      console.warn(`Doubt Solver: Model ${model} busy/failed, switching to next...`, err?.message);
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

    const ai = new GoogleGenAI({ apiKey });
    const reply = await generateDoubtResponse(ai, systemInstruction, fullPrompt);

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("AI Doubt Endpoint Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to solve doubt" },
      { status: 500 }
    );
  }
}
