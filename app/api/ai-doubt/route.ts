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

    // System prompt guides AI to speak naturally in clear spoken English/Hindi
    const systemPrompt = `You are the master AI Doubt Faculty for PrepWise (${examName}).
You must answer in this EXACT JSON structure:
{
  "written": "Your detailed step-by-step solution formatted with Markdown and clear equations for the phone screen.",
  "spoken": "A short, 2-to-3 sentence warm conversational voice explanation in simple everyday teacher language. No emojis, no markdown, no latex symbols, just clear spoken words."
}

Rules:
1. GREETINGS: If user just greets, acknowledge warmly and ask for their doubt in 'spoken' and 'written'.
2. If unable to return JSON, return the written solution directly.`;

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

            // Try parsing JSON structure
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
      { reply: "Abhi sabhi faculties busy hain. 1 minute baad dobara puchiye!", spoken: "Kripya 1 minute baad dobara puchiye." },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json({ reply: `Error: ${err.message}`, spoken: "Technical error." }, { status: 500 });
  }
}
