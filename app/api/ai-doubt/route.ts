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
  const errors: string[] = [];

  try {
    const { messages, query, image, isLive, targetExam, studentContext } = await req.json();

    const allKeys = getAllAvailableGeminiKeys();
    const { groq, openRouter } = getBackupProviders();

    // 1. Agar koi key nahi mili
    if (allKeys.length === 0 && !groq && !openRouter) {
      return NextResponse.json(
        {
          reply:
            "⚠️ Cloudflare Environment Variables mein koi API key nahi mili! Settings -> Environment variables mein LIVE_GEMINI_API_KEYS check karein aur Redeploy karein.",
        },
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
    // 1. GEMINI PROVIDER (2.0-flash & 1.5-flash)
    // ─────────────────────────────────────────────────────────────
    const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash"];
    const maxAttempts = Math.min(allKeys.length || 1, 4);
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      const apiKey = isLive ? getActiveLiveKey() : getActiveChatKey();
      if (!apiKey) break;

      for (const modelName of geminiModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

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
            errors.push(`Gemini ${modelName} 429/403: Rate limited on key ...${apiKey.slice(-5)}`);
            break;
          }

          if (!res.ok) {
            const errText = await res.text();
            errors.push(`Gemini ${modelName} ${res.status}: ${errText.slice(0, 150)}`);
            continue;
          }

          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return NextResponse.json({ reply, provider: `gemini-${modelName}`, success: true });
          }
        } catch (err: any) {
          errors.push(`Gemini ${modelName} exception: ${err.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GROQ PROVIDER FALLBACK
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      const groqModel = hasImage ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
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
          const gReply = gData.choices?.[0]?.message?.content;
          if (gReply) {
            return NextResponse.json({ reply: gReply, provider: `groq-${groqModel}`, success: true });
          }
        } else {
          const gErr = await groqRes.text();
          errors.push(`Groq ${groqRes.status}: ${gErr.slice(0, 120)}`);
        }
      } catch (gErr: any) {
        errors.push(`Groq exception: ${gErr.message}`);
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. OPENROUTER PROVIDER FALLBACK
    // ─────────────────────────────────────────────────────────────
    if (openRouter) {
      const orModel = hasImage
        ? "meta-llama/llama-3.2-11b-vision-instruct:free"
        : "deepseek/deepseek-chat:free";
      try {
        let orMessages: any[] = [];
        if (hasImage) {
          orMessages = [
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
          orMessages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: query || "Hello" },
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
            max_tokens: 1000,
          }),
        });

        if (orRes.ok) {
          const orData = await orRes.json();
          const orReply = orData.choices?.[0]?.message?.content;
          if (orReply) {
            return NextResponse.json({ reply: orReply, provider: `openrouter-${orModel}`, success: true });
          }
        } else {
          const orErr = await orRes.text();
          errors.push(`OpenRouter ${orRes.status}: ${orErr.slice(0, 120)}`);
        }
      } catch (orErr: any) {
        errors.push(`OpenRouter exception: ${orErr.message}`);
      }
    }

    // AGAR SABHI FAIL HUYE, TOH SCREEN PAR EXACT DIAGNOSTIC ERROR DIKHEGA:
    return NextResponse.json(
      {
        reply: `⚠️ AI Connection Error:\n${errors.join("\n")}`,
      },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { reply: `Server Error: ${error.message}` },
      { status: 500 }
    );
  }
}
