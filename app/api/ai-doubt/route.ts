// app/api/ai-doubt/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  getChatGeminiKeys,
  getLiveGeminiKeys,
  getGroqKey,
  getOpenRouterKey,
  reportKeyFailure,
  reportKeySuccess,
} from "@/lib/ai-key-manager";

export const runtime = "edge";

const SYSTEM_PROMPT = `You are the Senior Academic Faculty & Mentor for JEE and NEET at PrepWise.
Your task is to provide structured, textbook-quality solutions just like an official NCERT textbook or standard solution manual.

FORMATTING RULES:
1. NEVER output raw LaTeX tags like \\frac, \\sqrt, \\begin{aligned}, \\times, or \\left.
2. ALWAYS use clean textbook math and Unicode symbols:
   - Fractions: Use simple inline division: a/b or (x + y)/(z - w)
   - Powers/Subscripts: Use standard Unicode super/subscripts: x², y³, v₀, a₁, 10⁻³, cm³
   - Roots: Use √(expression)
   - Symbols: Use ×, ÷, ±, ≈, ≠, ≤, ≥, °, →, ⇒, ⇌, α, β, θ, λ, π, μ, ω, Δ
3. STRUCTURE:
   - 📌 **Concept / Given Data** (briefly state what is given and required)
   - 📐 **Formula Used** (state the standard formula clearly)
   - 📝 **Step-by-Step Solution** (numbered steps, clean arithmetic)
   - 🎯 **Final Answer** (highlight the final value, unit, or option)
4. TONE: Encouraging, precise, crystal clear. If the user asks a non-academic question or greeting, reply politely in 1-2 lines.`;

interface ImageAttachment {
  mimeType: string;
  data: string;
}

function extractImages(body: any): ImageAttachment[] {
  const images: ImageAttachment[] = [];

  const rawList: string[] = [];
  if (body.images && Array.isArray(body.images)) {
    rawList.push(...body.images);
  } else if (body.image && typeof body.image === "string") {
    rawList.push(body.image);
  }

  for (const item of rawList) {
    if (!item) continue;
    const match = item.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      images.push({ mimeType: match[1], data: match[2] });
    } else if (item.length > 50) {
      images.push({ mimeType: "image/jpeg", data: item });
    }
  }

  return images.slice(0, 2); // max 2 images safe limit
}

async function tryGemini(
  key: string,
  modelName: string,
  userText: string,
  images: ImageAttachment[]
): Promise<string> {
  const cleanModel = modelName.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${key}`;

  const parts: any[] = [];
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    });
  }
  parts.push({
    text: `${SYSTEM_PROMPT}\n\nStudent Query: ${userText || "Please solve and explain the question in this image."}`,
  });

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini ${cleanModel} ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned empty response");
  }
  return text;
}

async function tryGroq(
  groqKey: string,
  userText: string,
  images: ImageAttachment[]
): Promise<string> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const hasImages = images.length > 0;
  const model = hasImages ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";

  const contentParts: any[] = [];
  contentParts.push({
    type: "text",
    text: `${SYSTEM_PROMPT}\n\nStudent Query: ${userText || "Solve the problem in the image."}`,
  });

  for (const img of images) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    });
  }

  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: hasImages ? contentParts : contentParts[0].text,
      },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned empty text");
  return text;
}

async function tryOpenRouter(
  orKey: string,
  userText: string,
  images: ImageAttachment[]
): Promise<string> {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const hasImages = images.length > 0;
  const model = hasImages ? "google/gemini-2.0-flash-001" : "meta-llama/llama-3.3-70b-instruct:free";

  const contentParts: any[] = [];
  contentParts.push({
    type: "text",
    text: `${SYSTEM_PROMPT}\n\nStudent Query: ${userText || "Solve this doubt."}`,
  });

  for (const img of images) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    });
  }

  const payload = {
    model,
    messages: [
      {
        role: "user",
        content: hasImages ? contentParts : contentParts[0].text,
      },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${orKey}`,
      "HTTP-Referer": "https://eterprep.pages.dev",
      "X-Title": "PrepWise JEE NEET",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned empty text");
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userText = (body.message || "").trim();
    const mode = body.mode || "chat";
    const images = extractImages(body);

    if (!userText && images.length === 0) {
      return NextResponse.json(
        { reply: "Kripya koi sawal likhein ya photo attach karein." },
        { status: 400 }
      );
    }

    const geminiKeys = mode === "live" ? getLiveGeminiKeys() : getChatGeminiKeys();
    const candidateModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash"];

    const errorLogs: string[] = [];

    // TIER 1 & 2: Gemini
    for (const key of geminiKeys) {
      for (const model of candidateModels) {
        try {
          const reply = await tryGemini(key, model, userText, images);
          reportKeySuccess(key);
          return NextResponse.json({ reply, provider: `gemini-${model}` });
        } catch (err: any) {
          const isRateLimit = err?.message?.includes("429");
          reportKeyFailure(key, isRateLimit);
          errorLogs.push(err?.message || String(err));
        }
      }
    }

    // TIER 3: Groq Fallback
    const groqKey = getGroqKey();
    if (groqKey) {
      try {
        const reply = await tryGroq(groqKey, userText, images);
        return NextResponse.json({ reply, provider: "groq-fallback" });
      } catch (err: any) {
        errorLogs.push(`Groq: ${err?.message || String(err)}`);
      }
    }

    // TIER 4: OpenRouter Fallback
    const orKey = getOpenRouterKey();
    if (orKey) {
      try {
        const reply = await tryOpenRouter(orKey, userText, images);
        return NextResponse.json({ reply, provider: "openrouter-fallback" });
      } catch (err: any) {
        errorLogs.push(`OpenRouter: ${err?.message || String(err)}`);
      }
    }

    console.error("[AI Doubt Cascade Failed]", errorLogs);
    return NextResponse.json(
      {
        reply: "Abhi sabhi AI faculties thode busy hain. Kripya 1 minute baad dobara puchiye!",
      },
      { status: 200 }
    );
  } catch (globalErr: any) {
    return NextResponse.json(
      { reply: "Sawal samajhne mein dikkat aayi. Kripya dobara bhejiye." },
      { status: 200 }
    );
  }
}
