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

let cachedWorkingModel: string | null = null;

export async function POST(req: NextRequest) {
  const errors: string[] = [];

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
1. FORMULA FORMATTING: DO NOT output raw LaTeX code like \\frac{a}{b}, \\left(, \\right), or \\implies!
   Write formulas in clean readable textbook format:
   - Fractions: 1/f = (μ_rel - 1)(1/R₁ - 1/R₂)
   - Symbols: μ, θ, λ, Δ, π, ×, •, ⇒
   - Subscripts: R₁, R₂, μ_rel
2. DUAL RESPONSE (JSON): Return your answer in this exact JSON:
{
  "written": "Your clear, step-by-step solution formatted with clean textbook formulas for the phone screen.",
  "spoken": "A short, 2 to 3 sentence conversational explanation in clear everyday Hindi/English without any formulas, symbols, or emojis."
}
If unable to return JSON, return the written solution directly.`;

    const hasImage = Boolean(image);
    const apiKey = isLive ? getActiveLiveKey() : getActiveChatKey();

    // ─────────────────────────────────────────────────────────────
    // 1. PROVIDER 1: GEMINI (Auto-Discover Working Models)
    // ─────────────────────────────────────────────────────────────
    if (apiKey) {
      let modelsToTry: string[] = cachedWorkingModel ? [cachedWorkingModel] : [];

      if (modelsToTry.length === 0) {
        try {
          const listRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
          );
          if (listRes.ok) {
            const listData = await listRes.json();
            const liveModels = (listData.models || [])
              .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
              .map((m: any) => m.name.replace("models/", ""));

            const flash = liveModels.filter((m: string) => m.includes("flash"));
            modelsToTry = flash.length > 0 ? flash : liveModels;
          }
        } catch (_) {}
      }

      if (modelsToTry.length === 0) {
        modelsToTry = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-2.0-flash-exp"];
      }

      for (const model of modelsToTry.slice(0, 4)) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const parts: any[] = [];
          if (query) parts.push({ text: query });

          // Safe Base64 Regex with [\s\S]+ for large camera frames
          if (image) {
            const match = image.match(/^data:image\/([a-zA-Z0-9]+);base64,([\s\S]+)$/);
            if (match) {
              const mime = match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase();
              parts.push({
                inlineData: {
                  mimeType: `image/${mime}`,
                  data: match[2].trim(),
                },
              });
            }
          }

          const payload = {
            contents: [
              {
                role: "user",
                parts: parts.length > 0 ? parts : [{ text: "Explain the question shown." }],
              },
            ],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { temperature: 0.35, maxOutputTokens: 1000 },
          };

          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          if (res.status === 429 || res.status === 403) {
            markKeyRateLimited(apiKey, 60);
            errors.push(`Gemini ${model} rate limited (${res.status})`);
            break;
          }

          if (res.ok) {
            const data = await res.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            cachedWorkingModel = model; // Cache successful model

            try {
              const cleanJson = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();
              const parsed = JSON.parse(cleanJson);
              if (parsed.written) {
                return NextResponse.json({
                  reply: parsed.written,
                  spoken: parsed.spoken || parsed.written,
                  provider: `gemini-${model}`,
                  success: true,
                });
              }
            } catch (_) {}

            return NextResponse.json({
              reply: textResponse,
              spoken: textResponse.slice(0, 300),
              provider: `gemini-${model}`,
              success: true,
            });
          } else {
            const errT = await res.text();
            errors.push(`Gemini ${model} ${res.status}: ${errT.slice(0, 90)}`);
          }
        } catch (err: any) {
          errors.push(`Gemini ${model} err: ${err.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PROVIDER 2: GROQ FALLBACK (If Gemini is busy)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      const groqModel = hasImage ? "llama-3.2-11b-vision-preview" : "llama-3.1-8b-instant";
      try {
        let groqMessages: any[] = [];
        if (hasImage) {
          groqMessages = [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                { type: "text", text: query || "Solve this question step-by-step" },
                { type: "image_url", image_url: { url: image } },
              ],
            },
          ];
        } else {
          groqMessages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: query || "Hello" },
          ];
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groq}`,
          },
          body: JSON.stringify({
            model: groqModel,
            messages: groqMessages,
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        if (groqRes.ok) {
          const gData = await groqRes.json();
          const gReply = gData.choices?.[0]?.message?.content || "";
          return NextResponse.json({
            reply: gReply,
            spoken: gReply.slice(0, 300),
            provider: `groq-${groqModel}`,
            success: true,
          });
        } else {
          const gErr = await groqRes.text();
          errors.push(`Groq ${groqRes.status}: ${gErr.slice(0, 90)}`);
        }
      } catch (gErr: any) {
        errors.push(`Groq ex: ${gErr.message}`);
      }
    }

    return NextResponse.json(
      {
        reply: `⚠️ Live Doubt Error:\n${errors.join("\n")}`,
        spoken: "Faculty abhi busy hain, kripya dobara try karein.",
      },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { reply: `Server Error: ${error.message}`, spoken: "Technical error." },
      { status: 500 }
    );
  }
}
