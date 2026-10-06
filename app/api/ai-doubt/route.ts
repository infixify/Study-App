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

function cleanKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/["'\r\n]/g, "").trim();
  return cleaned.length > 10 ? cleaned : null;
}

export async function POST(req: NextRequest) {
  const errors: string[] = [];

  try {
    const { query, image, isLive, targetExam, studentContext } = await req.json();

    const { groq, openRouter } = getBackupProviders();
    const commonGeminiKey = cleanKey(process.env.GEMINI_API_KEY);
    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";
    const studentName = studentContext?.name || "Student";

    const systemPrompt = `You are the Master AI Doubt Faculty for ${studentName} (${examName}).
CRITICAL RULES:
1. FORMULA FORMATTING: DO NOT output complex raw LaTeX code like \\frac{a}{b}, \\left(, \\right), or \\implies!
   Write formulas in clean readable textbook format:
   - Fractions: 1/f = (μ_rel - 1)(1/R₁ - 1/R₂)
   - Symbols: μ, θ, λ, Δ, π, ×, •, ⇒
   - Subscripts: R₁, R₂, μ_rel
2. DUAL RESPONSE (JSON): Return your answer in this exact JSON:
{
  "written": "Your clear, step-by-step solution formatted with clean textbook formulas for the phone screen.",
  "spoken": "A short, 2 to 3 sentence conversational explanation in everyday teacher language without any formulas, symbols, or emojis."
}
If unable to return JSON, return the written solution directly.`;

    // ─────────────────────────────────────────────────────────────
    // 🔑 TIER 1 & TIER 2: GEMINI DEDICATED CHAT KEY ➔ COMMON BACKUP
    // ─────────────────────────────────────────────────────────────
    const primaryKey = isLive ? getActiveLiveKey() : getActiveChatKey();
    const geminiKeysToTry: string[] = [];
    if (primaryKey) geminiKeysToTry.push(primaryKey);
    if (commonGeminiKey && !geminiKeysToTry.includes(commonGeminiKey)) {
      geminiKeysToTry.push(commonGeminiKey);
    }

    for (const apiKey of geminiKeysToTry) {
      // Step A: Find clean working text models (Exclude audio/tts models!)
      let modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.0-flash-exp"];

      try {
        const listRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { signal: AbortSignal.timeout(4000) } // 4s timeout
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          const cleanModels = (listData.models || [])
            .filter(
              (m: any) =>
                m.supportedGenerationMethods?.includes("generateContent") &&
                !m.name.includes("tts") &&
                !m.name.includes("audio") &&
                !m.name.includes("latest") // Exclude overloaded "latest" alias
            )
            .map((m: any) => m.name.replace("models/", ""));

          const flashModels = cleanModels.filter((m: string) => m.includes("flash"));
          if (flashModels.length > 0) modelsToTry = flashModels;
        }
      } catch (_) {}

      // Step B: Call generateContent with strict 6-second timeout per attempt
      for (const model of modelsToTry.slice(0, 3)) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const parts: any[] = [];
          if (query) parts.push({ text: query });

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

          const res = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(6000), // ⚡ 6-SECOND TIMEOUT! (No more 2 minute hangs)
            body: JSON.stringify({
              contents: [{ role: "user", parts: parts.length > 0 ? parts : [{ text: "Explain this." }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 800,
              },
            }),
          });

          if (res.status === 429 || res.status === 403) {
            markKeyRateLimited(apiKey, 60);
            errors.push(`Gemini ${model} rate limited (${res.status})`);
            break; // Switch to next key
          }

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
            errors.push(`Gemini ${model} ${res.status}: ${errT.slice(0, 80)}`);
          }
        } catch (err: any) {
          errors.push(`Gemini ${model} timeout/err: ${err.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 🌐 TIER 3: GROQ BACKUP (Auto-Detect Active Groq Models in 3s)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      let groqModels = image
        ? ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"]
        : ["llama-3.3-70b-versatile", "gemma2-9b-it", "mixtral-8x7b-32768"];

      try {
        const gListRes = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${groq}` },
          signal: AbortSignal.timeout(3000),
        });
        if (gListRes.ok) {
          const gData = await gListRes.json();
          const liveIds = (gData.data || []).map((m: any) => m.id);
          if (liveIds.length > 0) {
            groqModels = image
              ? liveIds.filter((id: string) => id.includes("vision"))
              : liveIds.filter((id: string) => !id.includes("whisper"));
          }
        }
      } catch (_) {}

      for (const groqModel of groqModels.slice(0, 2)) {
        try {
          let groqMessages: any[] = [];
          if (image) {
            groqMessages = [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: [
                  { type: "text", text: query || "Solve this question" },
                  { type: "image_url", image_url: { url: image } },
                ],
              },
            ];
          } else {
            groqMessages = [
              { role: "system", content: systemPrompt },
              { role: "user", content: query || "Explain this" },
            ];
          }

          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groq}`,
            },
            signal: AbortSignal.timeout(5000), // 5s timeout
            body: JSON.stringify({
              model: groqModel,
              messages: groqMessages,
              temperature: 0.3,
              max_tokens: 800,
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
            errors.push(`Groq ${groqModel} ${groqRes.status}: ${gErr.slice(0, 80)}`);
          }
        } catch (gErr: any) {
          errors.push(`Groq ${groqModel} timeout/err: ${gErr.message}`);
        }
      }
    }

    return NextResponse.json(
      {
        reply: `⚠️ Chat Doubt Error:\n${errors.join("\n")}`,
        spoken: "Faculty abhi busy hain, kripya 1 minute baad puchiye.",
      },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json({ reply: `Server Error: ${error.message}`, spoken: "Error." }, { status: 500 });
  }
}
