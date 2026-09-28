// app/api/ai-doubt/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const apiKey =
  process.env.GEMINI_DOUBT_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GEMINI_MENTOR_KEY ||
  "";

export async function POST(req: Request) {
  try {
    const { question, imageBase64 } = await req.json();

    if (!question && !imageBase64) {
      return NextResponse.json({ error: "No question or image provided" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({
        reply:
          "Gemini API key configure nahi hai Vercel environment variables mein. Please GEMINI_API_KEY set karein!",
      });
    }

    // Prepare Gemini payload
    const parts: any[] = [];

    // System instruction prompt for Kota Doubt Faculty
    const systemPrompt = `
You are an expert JEE (Mains & Advanced) and NEET Doubt Solving Faculty.
Your task is to solve student academic questions with extreme clarity, precision, and pedagogical rigor.

Instructions:
1. If an image is provided, perform precise OCR to extract the question and any diagram details.
2. State the Given Data and the Core Concept/Formula being tested.
3. Provide a clear, Step-by-Step Mathematical/Conceptual derivation without skipping crucial steps.
4. Give the Final Answer clearly highlighted (including option letter if it is an MCQ).
5. Add a 1-line "Pro Tip / Common Trap" (e.g. where students usually make calculation or sign mistakes).
6. Language: Clean, student-friendly English (or polite Hinglish if asked).
`;

    parts.push({ text: systemPrompt });

    if (question && question.trim()) {
      parts.push({ text: `Student Question: ${question.trim()}` });
    }

    // Attach base64 image if present
    if (imageBase64 && typeof imageBase64 === "string") {
      // Extract pure base64 data and mime type (e.g. data:image/jpeg;base64,...)
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const data = match[2];
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: data,
          },
        });
      }
    }

    // Call Gemini 1.5 Flash Vision API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: parts,
            },
          ],
          generationConfig: {
            temperature: 0.2, // Low temperature for high math accuracy
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);
      return NextResponse.json(
        { reply: "Doubt solver abhi thoda busy hai. Please 10 seconds baad dobara try karein!" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const replyText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Question ka solution generate nahi ho paya. Please clear photo dobara upload karein.";

    return NextResponse.json({ reply: replyText });
  } catch (error: any) {
    console.error("AI Doubt endpoint error:", error);
    return NextResponse.json(
      { reply: "Internal server error. Please try again in a moment." },
      { status: 500 }
    );
  }
}
