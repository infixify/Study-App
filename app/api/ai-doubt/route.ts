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
    // 1. GEMINI PROVIDER (v1 gemini-1.5-flash & v1beta gemini-2.0-flash-exp)
    // ─────────────────────────────────────────────────────────────
    const geminiEndpoints = [
      { ver: "v1", model: "gemini-1.5-flash" },
      { ver: "v1beta", model: "gemini-2.0-flash-exp" },
      { ver: "v1beta", model: "gemini-1.5-flash-latest" },
    ];

    const maxAttempts = Math.min(allKeys.length || 1, 4);
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      const apiKey = isLive ? getActiveLiveKey() : getActiveChatKey();
      if (!apiKey) break;

      for (const { ver, model } of geminiEndpoints) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${apiKey}`;

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
            errors.push(`Gemini ${model} 429: Rate limited`);
            break;
          }

          if (!res.ok) {
            const errText = await res.text();
            errors.push(`Gemini ${model} ${res.status}: ${errText.slice(0, 100)}`);
            continue;
          }

          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return NextResponse.json({ reply, provider: `gemini-${model}`, success: true });
          }
        } catch (err: any) {
          errors.push(`Gemini ${model} err: ${err.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. GROQ PROVIDER (llama-3.1-8b-instant & llama-3.2-11b-vision-preview)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      const groqModels = hasImage
        ? ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"]
        : ["llama-3.1-8b-instant", "llama3-70b-8192"];

      for (const groqModel of groqModels) {
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
            errors.push(`Groq ${groqModel} ${groqRes.status}: ${gErr.slice(0, 100)}`);
          }
        } catch (gErr: any) {
          errors.push(`Groq ${groqModel} err: ${gErr.message}`);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. OPENROUTER PROVIDER (google/gemini-2.0-flash-exp:free)
    // ─────────────────────────────────────────────────────────────
    if (openRouter) {
      const orModels = hasImage
        ? ["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.2-11b-vision-instruct:free"]
        : ["google/gemini-2.0-flash-exp:free", "meta-llama/llama-3.2-3b-instruct:free"];

      for (const orModel of orModels) {
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
            errors.push(`OpenRouter ${orModel} ${orRes.status}: ${orErr.slice(0, 100)}`);
          }
        } catch (orErr: any) {
          errors.push(`OpenRouter ${orModel} err: ${orErr.message}`);
        }
      }
    }

    return NextResponse.json(
      { reply: `⚠️ AI Connection Error:\n${errors.join("\n")}` },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { reply: `Server Error: ${error.message}` },
      { status: 500 }
    );
  }
}
