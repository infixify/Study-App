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

// Cache discovered working model name in memory
let cachedGeminiModel: string | null = null;
let cachedGroqModel: string | null = null;

export async function POST(req: NextRequest) {
  const debugLogs: string[] = [];

  try {
    const { messages, query, image, isLive, targetExam, studentContext } = await req.json();

    const allKeys = getAllAvailableGeminiKeys();
    const { groq, openRouter } = getBackupProviders();

    if (allKeys.length === 0 && !groq && !openRouter) {
      return NextResponse.json(
        { reply: "⚠️ Cloudflare Environment Variables mein koi API key nahi mili!" },
        { status: 500 }
      );
    }

    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";

    const systemPrompt = `You are the Master AI Doubt Faculty for PrepWise (${examName}).
BEHAVIOR RULES:
1. GREETINGS: If user greets ("Hello", "Hi", "Namaste") without a question, reply warmly in 1 short sentence in Hinglish and encourage them to show/ask their doubt.
2. CONCEPTUAL/VOICE DOUBTS: If student asks verbally without showing a book/page, solve and explain it directly! DO NOT force them to show a page.
3. UNCLEAR VISUAL: If student says "solve this" but the image is completely blurry or blank, politely ask them to focus camera on the question.
4. ACADEMIC SOLUTION: Provide clear step-by-step solution, highlight final answer, and add an "⚡ Exam Shortcut:". Keep explanation encouraging and crisp.`;

    const hasImage = Boolean(image);

    // ─────────────────────────────────────────────────────────────
    // 1. PROVIDER 1: GEMINI (Auto-Discover Active Models for Key)
    // ─────────────────────────────────────────────────────────────
    const apiKey = isLive ? getActiveLiveKey() : getActiveChatKey();

    if (apiKey) {
      // Step A: Find working model from live Google catalog
      let modelsToTry: string[] = cachedGeminiModel
        ? [cachedGeminiModel]
        : ["gemini-1.5-flash-002", "gemini-1.5-flash-001", "gemini-1.5-flash", "gemini-2.0-flash-exp"];

      try {
        const listRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        if (listRes.ok) {
          const listData = await listRes.json();
          const liveModels = (listData.models || [])
            .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
            .map((m: any) => m.name.replace("models/", ""));

          if (liveModels.length > 0) {
            // Prioritize flash models, then any model
            const flash = liveModels.filter((m: string) => m.includes("flash"));
            modelsToTry = flash.length > 0 ? flash : liveModels;
            debugLogs.push(`Live Gemini models discovered: ${modelsToTry.slice(0, 3).join(", ")}`);
          }
        } else {
          const err = await listRes.text();
          debugLogs.push(`Gemini /models list error ${listRes.status}: ${err.slice(0, 80)}`);
        }
      } catch (e: any) {
        debugLogs.push(`Gemini discovery error: ${e.message}`);
      }

      // Step B: Execute generateContent on discovered model
      for (const model of modelsToTry) {
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

          const payload = {
            contents: [
              {
                role: "user",
                parts: parts.length > 0 ? parts : [{ text: "Hello" }],
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
            debugLogs.push(`Gemini ${model} 429: Rate limited`);
            break;
          }

          if (res.ok) {
            const data = await res.json();
            const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) {
              cachedGeminiModel = model; // Remember working model
              return NextResponse.json({ reply, provider: `gemini-${model}`, success: true });
            }
          } else {
            const t = await res.text();
            debugLogs.push(`Gemini ${model} ${res.status}: ${t.slice(0, 90)}`);
          }
        } catch (err: any) {
          debugLogs.push(`Gemini ${model} ex: ${err.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PROVIDER 2: GROQ (Auto-Discover Active Groq Models)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      let groqModelsToTry = cachedGroqModel ? [cachedGroqModel] : [];

      if (groqModelsToTry.length === 0) {
        try {
          const gListRes = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${groq}` },
          });
          if (gListRes.ok) {
            const gListData = await gListRes.json();
            const liveGModels = (gListData.data || []).map((m: any) => m.id);
            if (hasImage) {
              groqModelsToTry = liveGModels.filter((id: string) => id.includes("vision"));
            } else {
              groqModelsToTry = liveGModels.filter(
                (id: string) => id.includes("llama") || id.includes("gemma")
              );
            }
            if (groqModelsToTry.length === 0) groqModelsToTry = liveGModels;
            debugLogs.push(`Live Groq models discovered: ${groqModelsToTry.slice(0, 3).join(", ")}`);
          }
        } catch (_) {}
      }

      for (const groqModel of groqModelsToTry.slice(0, 3)) {
        try {
          let groqMessages: any[] = [];
          if (hasImage) {
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
            const gReply = gData.choices?.[0]?.message?.content;
            if (gReply) {
              cachedGroqModel = groqModel;
              return NextResponse.json({ reply: gReply, provider: `groq-${groqModel}`, success: true });
            }
          } else {
            const gt = await groqRes.text();
            debugLogs.push(`Groq ${groqModel} ${groqRes.status}: ${gt.slice(0, 90)}`);
          }
        } catch (gErr: any) {
          debugLogs.push(`Groq ${groqModel} ex: ${gErr.message}`);
        }
      }
    }

    return NextResponse.json(
      { reply: `⚠️ AI Auto-Discovery Report:\n${debugLogs.join("\n")}` },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { reply: `Server Error: ${error.message}` },
      { status: 500 }
    );
  }
}
