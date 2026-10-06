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
  const debugErrors: string[] = [];

  try {
    const { query, image, isLive, targetExam, studentContext } = await req.json();

    const { groq, openRouter } = getBackupProviders();
    const commonGeminiKey = cleanKey(process.env.GEMINI_API_KEY);
    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";
    const studentName = studentContext?.name || "Student";

    // ─────────────────────────────────────────────────────────────
    // PROMPT DIFFERENTIATION: LIVE (JSON + Short) vs CHAT (Direct Textbook)
    // ─────────────────────────────────────────────────────────────
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
Explain the student's doubt with utmost clarity, patience, and accuracy.
CRITICAL FORMATTING RULES:
1. NO RAW JSON: DO NOT return any JSON tags or {"written":...}. Return your explanation directly as rich text.
2. CLEAN FORMULAS: DO NOT use complex raw LaTeX code like \\frac{a}{b}, \\left(, \\right), or \\implies.
   Write formulas in clean readable textbook format:
   - Fractions: 1/f = (μ_rel - 1)(1/R₁ - 1/R₂)
   - Symbols: μ, θ, λ, Δ, π, ×, •, ⇒
   - Subscripts: R₁, R₂, μ_rel
3. STRUCTURE: Use bold titles for steps, clear bullet points, and highlight shortcuts with "⚡ Exam Shortcut:".`;

    // ─────────────────────────────────────────────────────────────
    // 🔑 TIER 1 & TIER 2: GEMINI KEYS
    // Live uses 5 Dedicated Live Keys; Chat uses GEMINI_API_KEY_DOUBT -> GEMINI_API_KEY
    // ─────────────────────────────────────────────────────────────
    const primaryKey = isLive ? getActiveLiveKey() : getActiveChatKey();
    const geminiKeysToTry: string[] = [];
    if (primaryKey) geminiKeysToTry.push(primaryKey);
    if (!isLive && commonGeminiKey && !geminiKeysToTry.includes(commonGeminiKey)) {
      geminiKeysToTry.push(commonGeminiKey);
    }

    const models = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-2.0-flash-exp"];

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
            signal: AbortSignal.timeout(6500), // 6.5s hard timeout
            body: JSON.stringify({
              contents: [{ role: "user", parts: parts.length > 0 ? parts : [{ text: "Explain this." }] }],
              systemInstruction: { parts: [{ text: systemPrompt }] },
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: isLive ? 350 : 850,
              },
            }),
          });

          if (res.status === 429 || res.status === 403) {
            markKeyRateLimited(apiKey, 60);
            debugErrors.push(`Gemini ${model} 429: Rate limited`);
            break; // Switch to next key
          }

          if (res.ok) {
            const data = await res.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

            // If Live Call, parse JSON for HUD
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
              return NextResponse.json({
                reply: textResponse,
                spoken: textResponse.slice(0, 300),
                provider: `gemini-${model}`,
                success: true,
              });
            }

            // If Normal Chat, clean any stray JSON and return direct textbook markdown
            let cleanText = textResponse;
            try {
              const parsed = JSON.parse(textResponse.replace(/```json/g, "").replace(/```/g, "").trim());
              if (parsed.written) cleanText = parsed.written;
            } catch (_) {}

            return NextResponse.json({
              reply: cleanText,
              provider: `gemini-${model}`,
              success: true,
            });
          } else {
            const errT = await res.text();
            debugErrors.push(`Gemini ${model} ${res.status}: ${errT.slice(0, 70)}`);
          }
        } catch (err: any) {
          debugErrors.push(`Gemini ${model} ex: ${err.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 🌐 TIER 3: GROQ BACKUP (GROQ_API_KEY)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      const groqModel = image ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
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
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            model: groqModel,
            messages: groqMessages,
            temperature: 0.3,
            max_tokens: 850,
          }),
        });

        if (groqRes.ok) {
          const gData = await groqRes.json();
          const gReply = gData.choices?.[0]?.message?.content || "";
          return NextResponse.json({
            reply: gReply,
            provider: `groq-${groqModel}`,
            success: true,
          });
        }
      } catch (gErr: any) {
        debugErrors.push(`Groq ex: ${gErr.message}`);
      }
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
          signal: AbortSignal.timeout(6000),
          body: JSON.stringify({
            model: orModel,
            messages: orMessages,
            temperature: 0.3,
            max_tokens: 850,
          }),
        });

        if (orRes.ok) {
          const orData = await orRes.json();
          const orReply = orData.choices?.[0]?.message?.content || "";
          return NextResponse.json({
            reply: orReply,
            provider: `openrouter-${orModel}`,
            success: true,
          });
        }
      } catch (orErr: any) {
        debugErrors.push(`OpenRouter ex: ${orErr.message}`);
      }
    }

    return NextResponse.json(
      {
        reply: `⚠️ Chat Doubt Error:\n${debugErrors.join("\n")}`,
      },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json({ reply: `Server Error: ${err.message}` }, { status: 500 });
  }
}
