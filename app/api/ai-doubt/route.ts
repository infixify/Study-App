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
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({
        reply:
          "Gemini API key configure nahi hai Vercel environment variables mein. Please GEMINI_API_KEY set karein!",
      });
    }

    const systemPrompt = `
You are an expert JEE (Mains & Advanced) and NEET Doubt Solving Faculty at a premier coaching institute.
Your task is to solve student academic questions with extreme clarity, precision, and pedagogical rigor.

Instructions:
1. Remember previous conversation context: If an image was shared earlier, refer to that question.
2. If an image is provided, perform precise OCR to extract the question and any diagram details.
3. State the Given Data and the Core Concept/Formula being tested.
4. Provide a clear, Step-by-Step Mathematical/Conceptual derivation without skipping crucial steps.
5. Highlight the Final Answer clearly (including option letter if it is an MCQ).
6. Add a 1-line "Pro Tip / Common Trap" (where students usually make calculation or sign mistakes).
7. Language: Clean, student-friendly English (or polite Hinglish if asked).
`;

    // Convert chat history into Gemini contents format
    const contents: any[] = [];

    // System turn
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I am ready to solve JEE/NEET doubts step-by-step with full accuracy." }],
    });

    // Add recent conversation history (last 6 messages for context)
    const recentMessages = messages.slice(-6);

    for (const msg of recentMessages) {
      const role = msg.role === "user" ? "user" : "model";
      const parts: any[] = [];

      if (msg.content && msg.content.trim()) {
        parts.push({ text: msg.content.trim() });
      }

      // Check if this message had an image
      if (msg.image && typeof msg.image === "string") {
        const match = msg.image.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inline_data: {
              mime_type: match[1],
              data: match[2],
            },
          });
        }
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.2,
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
      "Question ka solution generate nahi ho paya. Please dobara try karein.";

    return NextResponse.json({ reply: replyText });
  } catch (error: any) {
    console.error("AI Doubt endpoint error:", error);
    return NextResponse.json(
      { reply: "Internal server error. Please try again in a moment." },
      { status: 500 }
    );
  }
}
