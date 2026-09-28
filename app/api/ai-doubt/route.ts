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
    const body = await req.json();
    const { messages, question, imageBase64 } = body;

    if (!apiKey) {
      return NextResponse.json({
        reply: "Gemini API Key missing on Vercel. Please check environment variables.",
      });
    }

    let promptText = question || "";
    let rawImage = imageBase64 || null;

    if (Array.isArray(messages) && messages.length > 0) {
      const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");
      if (lastUserMsg) {
        if (!promptText && lastUserMsg.content) promptText = lastUserMsg.content;
        if (!rawImage && lastUserMsg.image) rawImage = lastUserMsg.image;
      }
    }

    if (!promptText && !rawImage) {
      return NextResponse.json({ reply: "Please provide a question or an image to solve." });
    }

    const parts: any[] = [];

    parts.push({
      text: `You are an expert Kota JEE & NEET Doubt Solving Faculty.
Solve the following academic problem step-by-step.
- If an image is provided, extract the question and solve it.
- State the Given data and core formula.
- Provide clear mathematical/conceptual steps.
- Highlight the Final Answer clearly.
- Language: Clear, student-friendly English.`
    });

    if (promptText && promptText.trim()) {
      parts.push({ text: `Question: ${promptText.trim()}` });
    } else {
      parts.push({ text: "Please solve the question in the attached image step-by-step." });
    }

    if (rawImage && typeof rawImage === "string") {
      let mimeType = "image/jpeg";
      let base64Data = rawImage;

      if (rawImage.includes(",")) {
        const [header, data] = rawImage.split(",");
        base64Data = data;
        const mimeMatch = header.match(/:(.*?);/);
        if (mimeMatch) mimeType = mimeMatch[1];
      }

      if (base64Data) {
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Data.trim(),
          },
        });
      }
    }

    // Active official Google Gemini Flash model
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    });

    const resJson = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error Detail:", resJson);
      const errMsg = resJson?.error?.message || "Google API request rejected";
      return NextResponse.json({ reply: `AI Engine Error: ${errMsg}` }, { status: 200 });
    }

    const answer =
      resJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Could not generate solution for this image. Please upload a clearer crop of the question.";

    return NextResponse.json({ reply: answer });
  } catch (error: any) {
    console.error("Endpoint crash error:", error);
    return NextResponse.json(
      { reply: `Server error: ${error.message || "Something went wrong"}` },
      { status: 200 }
    );
  }
}
