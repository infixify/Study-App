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
  try {
    const { query, image, isLive, targetExam, studentContext } = await req.json();

    const { groq, openRouter } = getBackupProviders();
    const commonGeminiKey = cleanKey(process.env.GEMINI_API_KEY);
    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";
    const studentName = studentContext?.name || "Student";

    const systemPrompt = isLive
      ? `You are the personal AI Faculty for ${studentName} (${examName}) on a real-time live video call.
Be energetic, encouraging, and clear like a top mentor.
CRITICAL RULES:
1. FORMULAS: Write formulas in clean textbook notation: 1/f = (μ_rel - 1)(1/R₁ - 1/R₂). Do NOT use \\frac or \\left.
2. DUAL OUTPUT JSON: Return JSON:
{
  "written": "Clear step-by-step textbook solution for the screen HUD.",
  "spoken": "Crisp 2-3 sentence conversational spoken answer without any symbols, formulas, or emojis."
}`
      : `You are the Master AI Doubt Faculty for ${studentName} (${examName}).
Provide a detailed step-by-step written solution for their doubt.
Use clean textbook formulas like 1/f = (μ - 1)(1/R₁ - 1/R₂). Format with clear bullet points.`;

    // ─────────────────────────────────────────────────────────────
    // 🔑 TIER 1 & TIER 2: GEMINI DEDICATED KEYS ➔ COMMON BACKUP
    // ─────────────────────────────────────────────────────────────
    const primaryKey = isLive ? getActiveLiveKey() : getActiveChatKey();
    
    // Key sequence: Primary Dedicated Key ➔ Common Backup Key
    const geminiKeysToTry: string[] = [];
    if (primaryKey) geminiKeysToTry.push(primaryKey);
    if (commonGeminiKey && !geminiKeysToTry.includes(commonGeminiKey)) {
      geminiKeysToTry.push(commonGeminiKey);
    }

    const models = ["gemini-1.5-flash-002", "gemini-1.5-flash", "gemini-2.0-flash-exp"];

    for (const apiKey of geminiKeysToTry) {
      for (const model of models) {
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
            break; // Switch to Common Backup Key or next provider
          }

          if (res.ok) {
            const data = await res.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
          }
        } catch (_) {}
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 🌐 TIER 3: GROQ BACKUP (GROQ_API_KEY)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      const groqModel = image ? "llama-3.2-11b-vision-preview" : "llama-3.1-8b-instant";
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
          return NextResponse.json({
            reply: gReply,
            spoken: gReply.slice(0, 300),
            provider: `groq-${groqModel}`,
            success: true,
          });
        }
      } catch (_) {}
    }

    // ─────────────────────────────────────────────────────────────
    // 🌐 TIER 4: OPENROUTER BACKUP (OPENROUTER_API_KEY)
    // ─────────────────────────────────────────────────────────────
    if (openRouter) {
      const orModel = image
        ? "meta-llama/llama-3.2-11b-vision-instruct:free"
        : "meta-llama/llama-3.2-3b-instruct:free";

      try {
        let orMessages: any[] = [];
        if (image) {
          orMessages = [
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
          orMessages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: query || "Explain this" },
          ];
        }

        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouter}`,
            "HTTP-Referer": "https://eterprep.pages.dev",
            "X-Title": "PrepWise AI Faculty",
          },
          body: JSON.stringify({
            model: orModel,
            messages: orMessages,
            temperature: 0.3,
            max_tokens: isLive ? 400 : 900,
          }),
        });

        if (orRes.ok) {
          const orData = await orRes.json();
          const orReply = orData.choices?.[0]?.message?.content || "";
          return NextResponse.json({
            reply: orReply,
            spoken: orReply.slice(0, 300),
            provider: `openrouter-${orModel}`,
            success: true,
          });
        }
      } catch (_) {}
    }

    return NextResponse.json(
      {
        reply: "Abhi sabhi AI faculties busy hain. Kripya 1 minute baad dobara puchiye!",
        spoken: "Faculty abhi busy hain, kripya 1 minute baad puchiye.",
      },
      { status: 503 }
    );
  } catch (err: any) {
    return NextResponse.json({ reply: `Error: ${err.message}`, spoken: "Error." }, { status: 500 });
  }
}
