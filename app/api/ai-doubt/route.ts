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

// Memory caches for working models discovered live
let cachedWorkingGeminiModel: string | null = null;
let cachedWorkingGroqModel: string | null = null;

export async function POST(req: NextRequest) {
  const debugErrors: string[] = [];

  try {
    const { query, image, isLive, targetExam, studentContext } = await req.json();

    const { groq, openRouter } = getBackupProviders();
    const commonGeminiKey = cleanKey(process.env.GEMINI_API_KEY);
    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";
    const studentName = studentContext?.name || "Student";

    const systemPrompt = isLive
      ? `You are the personal AI Faculty for ${studentName} (${examName}) on a real-time live video call.
Be energetic, concise, and clear.
RULES:
1. FORMULAS: Write formulas in clean textbook notation: 1/f = (μ_rel - 1)(1/R₁ - 1/R₂). Do NOT use \\frac or \\left.
2. DUAL OUTPUT JSON: Return JSON:
{
  "written": "Clear step-by-step textbook solution for the screen HUD.",
  "spoken": "Crisp 2-3 sentence conversational spoken answer in everyday teacher language without any formulas, symbols, or emojis."
}`
      : `You are the Master AI Doubt Faculty for ${studentName} (${examName}).
Provide a detailed step-by-step written solution for their doubt.
Use clean textbook formulas like 1/f = (μ - 1)(1/R₁ - 1/R₂). Format with clear bullet points.`;

    // ─────────────────────────────────────────────────────────────
    // 🔑 TIER 1 & TIER 2: GEMINI DEDICATED KEYS ➔ COMMON BACKUP
    // ─────────────────────────────────────────────────────────────
    const primaryKey = isLive ? getActiveLiveKey() : getActiveChatKey();
    const geminiKeysToTry: string[] = [];
    if (primaryKey) geminiKeysToTry.push(primaryKey);
    if (commonGeminiKey && !geminiKeysToTry.includes(commonGeminiKey)) {
      geminiKeysToTry.push(commonGeminiKey);
    }

    for (const apiKey of geminiKeysToTry) {
      // Step A: Auto-Discover active models for this key from Google
      let modelsToTry: string[] = cachedWorkingGeminiModel ? [cachedWorkingGeminiModel] : [];

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

      // Step B: Call generateContent
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
            body: JSON.stringify({
              contents: [{ role: "user", parts: parts.length > 0 ? parts : [{ text: "Explain this." }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: isLive ? 350 : 900,
              },
            }),
          });

          if (res.status === 429 || res.status === 403) {
            markKeyRateLimited(apiKey, 60);
            debugErrors.push(`Gemini ${model} 429: Rate limited`);
            break;
          }

          if (res.ok) {
            const data = await res.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            cachedWorkingGeminiModel = model;

            if (isLive) {
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
            }

            return NextResponse.json({
              reply: textResponse,
              spoken: textResponse.slice(0, 300),
              provider: `gemini-${model}`,
              success: true,
            });
          } else {
            const errT = await res.text();
            debugErrors.push(`Gemini ${model} ${res.status}: ${errT.slice(0, 90)}`);
          }
        } catch (err: any) {
          debugErrors.push(`Gemini ${model} ex: ${err.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 🌐 TIER 3: GROQ BACKUP (Auto-Discover Active Groq Models)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      let groqModelsToTry = cachedWorkingGroqModel ? [cachedWorkingGroqModel] : [];

      if (groqModelsToTry.length === 0) {
        try {
          const gListRes = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${groq}` },
          });
          if (gListRes.ok) {
            const gListData = await gListRes.json();
            const liveGModels = (gListData.data || []).map((m: any) => m.id);
            if (image) {
              groqModelsToTry = liveGModels.filter((id: string) => id.includes("vision"));
            } else {
              groqModelsToTry = liveGModels.filter(
                (id: string) => id.includes("llama") || id.includes("gemma")
              );
            }
            if (groqModelsToTry.length === 0) groqModelsToTry = liveGModels;
          }
        } catch (_) {}
      }

      for (const groqModel of groqModelsToTry.slice(0, 2)) {
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
            body: JSON.stringify({
              model: groqModel,
              messages: groqMessages,
              temperature: 0.3,
              max_tokens: isLive ? 400 : 900,
            }),
          });

          if (groqRes.ok) {
            const gData = await groqRes.json();
            const gReply = gData.choices?.[0]?.message?.content || "";
            cachedWorkingGroqModel = groqModel;
            return NextResponse.json({
              reply: gReply,
              spoken: gReply.slice(0, 300),
              provider: `groq-${groqModel}`,
              success: true,
            });
          }
        } catch (_) {}
      }
    }

    return NextResponse.json(
      {
        reply: `⚠️ AI Connection Error:\n${debugErrors.join("\n")}`,
        spoken: "Faculty abhi busy hain, kripya 1 minute baad puchiye.",
      },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json({ reply: `Server Error: ${err.message}`, spoken: "Error." }, { status: 500 });
  }
}
