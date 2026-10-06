// app/api/ai-doubt/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveLiveKey,
  getActiveChatKey,
  getAllAvailableGeminiKeys,
  markKeyRateLimited,
  getBackupProviders,
} from "@/lib/ai-key-manager";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { query, image, isLive, targetExam, studentContext } = await req.json();

    const allKeys = getAllAvailableGeminiKeys();
    const { groq } = getBackupProviders();

    if (allKeys.length === 0 && !groq) {
      return NextResponse.json(
        { reply: "⚠️ API keys check karein!", spoken: "API key missing hai." },
        { status: 500 }
      );
    }

    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";

    const systemPrompt = `You are the Master AI Doubt Faculty for PrepWise (${examName}).
CRITICAL RULES:
1. FORMULA FORMATTING: DO NOT output complex raw LaTeX code like \\frac{a}{b}, \\left(, \\right), or \\implies!
   Write formulas in clean, readable textbook format:
   - Use standard fractions: 1/f = (μ_rel - 1)(1/R₁ - 1/R₂)
   - Use standard symbols: μ, θ, λ, Δ, π, ×, •, ⇒
   - Subscripts: R₁, R₂, μ_rel
2. DUAL RESPONSE (JSON): Return your answer in this exact JSON:
{
  "written": "Your clear, step-by-step solution formatted with clean textbook formulas for the phone screen.",
  "spoken": "A short, 2 to 3 sentence conversational explanation in clear everyday Hindi/English without any formulas, symbols, or emojis."
}
If unable to return JSON, return the written solution directly.`;

    const apiKey = isLive ? getActiveLiveKey() : getActiveChatKey();
    if (apiKey) {
      const models = ["gemini-1.5-flash-002", "gemini-1.5-flash", "gemini-2.0-flash-exp"];

      for (const model of models) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const parts: any[] = [];
          if (query) parts.push({ text: query });
          if (image) {
            const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: `image/${match[1] === "jpg" ? "jpeg" : match[1]}`,
                  data: match[2],
                },
              });
            }
          }

          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: parts.length > 0 ? parts : [{ text: "Hello" }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: { temperature: 0.3, maxOutputTokens: 1000 },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            try {
              const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
              const parsed = JSON.parse(cleanJson);
              if (parsed.written) {
                return NextResponse.json({
                  reply: parsed.written,
                  spoken: parsed.spoken || parsed.written,
                  success: true,
                });
              }
            } catch (_) {}

            return NextResponse.json({
              reply: textResponse,
              spoken: textResponse.slice(0, 300),
              success: true,
            });
          }
        } catch (_) {}
      }
    }

    return NextResponse.json(
      {
        reply: "Abhi sabhi faculties busy hain. 1 minute baad dobara puchiye!",
        spoken: "Kripya 1 minute baad dobara puchiye.",
      },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { reply: `Error: ${err.message}`, spoken: "Technical error." },
      { status: 500 }
    );
  }
}
