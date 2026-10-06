// app/api/ai-doubt/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getActiveLiveKey,
  getActiveChatKey,
  markKeyRateLimited,
  getBackupProviders,
} from "@/lib/ai-key-manager";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { messages, query, image, isLive, targetExam, studentContext } = await req.json();

    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";

    const systemPrompt = `You are the Master AI Doubt Faculty for PrepWise (${examName}).
BEHAVIOR RULES:
1. GREETINGS & SHORT TALK: If student greets ("Hello", "Hi", "Namaste") without asking a question, reply warmly in 1 short sentence in Hinglish and encourage them to show/ask their doubt.
2. CONCEPTUAL/VOICE DOUBTS: If student asks verbally without showing a book/page, solve and explain it directly! DO NOT force them to show a page.
3. UNCLEAR VISUAL: If student says "solve this" but the image is completely blurry or blank, politely ask them to focus camera on the question.
4. ACADEMIC SOLUTION: Provide clear step-by-step solution, highlight final answer, and add an "⚡ Exam Shortcut:". Keep explanation encouraging and crisp.`;

    const hasImage = Boolean(image);

    // ─────────────────────────────────────────────────────────────
    // 1. PROVIDER 1: GOOGLE GEMINI (With Model Fallback: 2.0 -> 1.5)
    // ─────────────────────────────────────────────────────────────
    const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash"];
    const maxGeminiAttempts = isLive ? 4 : 2;
    let attempts = 0;

    while (attempts < maxGeminiAttempts) {
      attempts++;
      const apiKey = isLive ? getActiveLiveKey() : getActiveChatKey();
      if (!apiKey) break;

      // Gemini Model Cascade Loop (2.0-flash -> 1.5-flash)
      for (const modelName of geminiModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

          const parts: any[] = [];
          if (query) parts.push({ text: query });
          if (image) {
            const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
            if (match) {
              parts.push({
                inline_data: {
                  mime_type: `image/${match[1]}`,
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
            console.warn(`[AI-Doubt] Gemini 429 on key. Excluding key...`);
            markKeyRateLimited(apiKey, 60);
            break; // Break inner model loop to rotate to another key
          }

          if (res.status === 503 || res.status === 500) {
            console.warn(`[AI-Doubt] ${modelName} overloaded (503). Cascading to next Gemini model...`);
            continue; // Try 1.5-flash on same key
          }

          if (!res.ok) continue;

          const data = await res.json();
          const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (reply) {
            return NextResponse.json({ reply, provider: `gemini-${modelName}`, success: true });
          }
        } catch (err) {
          console.error(`[AI-Doubt] Gemini ${modelName} error:`, err);
        }
      }
    }

    const { groq, openRouter } = getBackupProviders();

    // ─────────────────────────────────────────────────────────────
    // 2. PROVIDER 2: GROQ (Smart Vision vs Text Model Cascade)
    // ─────────────────────────────────────────────────────────────
    if (groq) {
      const groqModels = hasImage
        ? ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"]
        : ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

      for (const groqModel of groqModels) {
        try {
          console.log(`[AI-Doubt] Invoking Groq Fallback Model: ${groqModel}...`);
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
              { role: "user", content: query || "Explain this topic" },
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
            console.warn(`[AI-Doubt] Groq ${groqModel} returned status ${groqRes.status}. Trying next...`);
          }
        } catch (gErr) {
          console.error(`[AI-Doubt] Groq ${groqModel} error:`, gErr);
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PROVIDER 3: OPENROUTER (Deep Multi-Model Cascade)
    // ─────────────────────────────────────────────────────────────
    if (openRouter) {
      const orModels = hasImage
        ? [
            "meta-llama/llama-3.2-11b-vision-instruct:free",
            "google/gemini-2.0-flash-exp:free",
          ]
        : [
            "deepseek/deepseek-chat:free",
            "meta-llama/llama-3.3-70b-instruct:free",
          ];

      for (const orModel of orModels) {
        try {
          console.log(`[AI-Doubt] Invoking OpenRouter Fallback Model: ${orModel}...`);
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
              { role: "user", content: query || "Explain this concept" },
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
          }
        } catch (orErr) {
          console.error(`[AI-Doubt] OpenRouter ${orModel} error:`, orErr);
        }
      }
    }

    return NextResponse.json(
      { reply: "Abhi sabhi AI faculties busy hain. Kripya 1 minute baad dobara puchiye!" },
      { status: 503 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { reply: "Technical error. Kripya dobara try karein!" },
      { status: 500 }
    );
  }
}
