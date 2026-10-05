// app/api/ai-doubt/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getActiveGeminiKey, markKeyRateLimited } from "@/lib/ai-key-manager";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { messages, query, image, targetExam, studentContext } = await req.json();

    const examName = targetExam || studentContext?.targetExam || "JEE/NEET";

    const systemPrompt = `You are the master AI Doubt Faculty for PrepWise (${examName}).
BEHAVIOR RULES:
1. GREETINGS & SHORT TALK: If student says "Hello", "Hi", "Namaste" or greets without a question, reply warmly in 1 short sentence in Hinglish and politely ask them to show or ask their question.
2. VOICE/CONCEPTUAL QUESTIONS: If student asks a conceptual, theoretical, or formula question verbally without showing a book/page, DO NOT ask them to show a page! Directly solve and explain it clearly.
3. UNCLEAR VISUAL: If student says "solve this" but the camera image is completely blurry or blank, ask them to point the camera clearly at the question.
4. QUESTION SOLVING: When solving an academic question:
   - Provide a clear, step-by-step solution.
   - Highlight final answer and shortcut/exam tip with "⚡ Exam Shortcut:".
   - Keep tone energetic, encouraging, and mentor-like.
   - Use Markdown for neat formulas.`;

    let attempts = 0;
    const maxAttempts = 5; // Will try other keys if one gets 429

    while (attempts < maxAttempts) {
      attempts++;
      const apiKey = getActiveGeminiKey();

      if (!apiKey) {
        break;
      }

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
            temperature: 0.4,
            maxOutputTokens: 1000,
          },
        };

        const res = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.status === 429 || res.status === 403) {
          console.warn(`[AI-Doubt] Key rate limited (${res.status}). Auto-excluding and retrying next key...`);
          markKeyRateLimited(apiKey, 60);
          continue; // Instantly retry next key!
        }

        if (!res.ok) {
          const errText = await res.text();
          console.error("[AI-Doubt] Gemini API error:", errText);
          continue;
        }

        const data = await res.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (reply) {
          return NextResponse.json({ reply, success: true });
        }
      } catch (err) {
        console.error("[AI-Doubt] Fetch exception:", err);
      }
    }

    return NextResponse.json(
      { reply: "Filhaal sabhi AI faculties thode busy hain. Kripya 1 minute baad dobara puchiye!" },
      { status: 503 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { reply: "Technical error. Kripya dobara try karein!" },
      { status: 500 }
    );
  }
}
