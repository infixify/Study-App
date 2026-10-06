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
1. GREETINGS & SHORT TALK: If student greets ("Hello", "Hi", "Namaste") without a question, reply warmly in 1 short sentence in Hinglish and encourage them to show/ask their doubt.
2. CONCEPTUAL/VOICE DOUBTS: If student asks verbally without showing a book/page, solve and explain it directly! DO NOT force them to show a page.
3. UNCLEAR VISUAL: If student says "solve this" but the image is completely blurry or blank, politely ask them to focus camera on the question.
4. ACADEMIC SOLUTION: Provide clear step-by-step solution, highlight final answer, and add an "⚡ Exam Shortcut:". Keep explanation encouraging and crisp.`;

    // ── TIER 1 & TIER 2: GEMINI PRIMARY POOL & COMMON BACKUP ──
    const maxGeminiAttempts = isLive ? 4 : 2;
    let attempts = 0;

    while (attempts < maxGeminiAttempts) {
      attempts++;
      const apiKey = isLive ? getActiveLiveKey() : getActiveChatKey();
      if (!apiKey) break;

      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 1000,
          },
        };

        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 429 || res.status === 403) {
          console.warn(`[AI-Doubt] Gemini 429 hit. Auto-excluding key...`);
          markKeyRateLimited(apiKey, 60);
          continue; // Instantly retry next key in pool
        }

        if (!res.ok) continue;

        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          return NextResponse.json({ reply, provider: "gemini", success: true });
        }
      } catch (err) {
        console.error("[AI-Doubt] Gemini attempt failed:", err);
      }
    }

    const { groq, openRouter } = getBackupProviders();

    // ── TIER 3: GROQ BACKUP (Llama 3.2 Vision) ──
    if (groq) {
      try {
        console.log("[AI-Doubt] Falling back to Tier 3: Groq...");
        const groqContent: any[] = [];
        if (query) groqContent.push({ type: "text", text: query });
        if (image) {
          groqContent.push({
            type: "image_url",
            image_url: { url: image },
          });
        }
        if (groqContent.length === 0) groqContent.push({ type: "text", text: "Hello" });

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groq}`,
          },
          body: JSON.stringify({
            model: "llama-3.2-11b-vision-preview",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: groqContent },
            ],
            temperature: 0.3,
            max_tokens: 900,
          }),
        });

        if (groqRes.ok) {
          const gData = await groqRes.json();
          const gReply = gData.choices?.[0]?.message?.content;
          if (gReply) {
            return NextResponse.json({ reply: gReply, provider: "groq-backup", success: true });
          }
        }
      } catch (gErr) {
        console.error("[AI-Doubt] Groq backup failed:", gErr);
      }
    }

    // ── TIER 4: OPENROUTER BACKUP ──
    if (openRouter) {
      try {
        console.log("[AI-Doubt] Falling back to Tier 4: OpenRouter...");
        const orContent: any[] = [];
        if (query) orContent.push({ type: "text", text: query });
        if (image) {
          orContent.push({
            type: "image_url",
            image_url: { url: image },
          });
        }
        if (orContent.length === 0) orContent.push({ type: "text", text: "Hello" });

        const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openRouter}`,
            "HTTP-Referer": "https://eterprep.pages.dev",
            "X-Title": "PrepWise AI Doubt Faculty",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3.2-11b-vision-instruct:free",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: orContent },
            ],
            temperature: 0.3,
            max_tokens: 900,
          }),
        });

        if (orRes.ok) {
          const orData = await orRes.json();
          const orReply = orData.choices?.[0]?.message?.content;
          if (orReply) {
            return NextResponse.json({ reply: orReply, provider: "openrouter-backup", success: true });
          }
        }
      } catch (orErr) {
        console.error("[AI-Doubt] OpenRouter backup failed:", orErr);
      }
    }

    return NextResponse.json(
      { reply: "Abhi sabhi AI faculties thode busy hain. Kripya 1 minute baad dobara puchiye!" },
      { status: 503 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { reply: "Technical error. Kripya dobara try karein!" },
      { status: 500 }
    );
  }
}
