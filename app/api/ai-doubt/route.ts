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
4. TONE: Encouraging, precise, crystal clear. If the user asks a greeting (like 'Hello', 'Hi'), reply warmly and politely in 1-2 lines inviting them to ask any study doubt.`;

interface ImageAttachment {
  mimeType: string;
  data: string; // pure base64 without prefix
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
    if (!item || typeof item !== "string" || item.length < 20) continue;

    let mimeType = "image/jpeg";
    let data = item.trim();

    if (data.startsWith("data:")) {
      const commaIndex = data.indexOf(",");
      if (commaIndex !== -1) {
        const header = data.substring(0, commaIndex);
        data = data.substring(commaIndex + 1);

        if (header.includes("png")) mimeType = "image/png";
        else if (header.includes("webp")) mimeType = "image/webp";
        else mimeType = "image/jpeg";
      }
    }

    data = data.replace(/[\r\n\s]/g, "");

    if (data.length > 50) {
      images.push({ mimeType, data });
    }
  }

  return images.slice(0, 2);
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
    text: `${SYSTEM_PROMPT}\n\nStudent Query: ${userText || "Please solve and explain the question in this image step-by-step."}`,
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
    throw new Error(`Gemini ${cleanModel} ${res.status}: ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error(`Gemini ${cleanModel} returned empty response`);
  }
  return text;
}

async function tryGroq(
  groqKey: string,
  model: string,
  userText: string,
  images: ImageAttachment[]
): Promise<string> {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const hasImages = images.length > 0;

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
    throw new Error(`Groq ${model} ${res.status}: ${err.slice(0, 180)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq ${model} returned empty text`);
  return text;
}

async function tryOpenRouter(
  orKey: string,
  model: string,
  userText: string,
  images: ImageAttachment[]
): Promise<string> {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  const hasImages = images.length > 0;

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
    throw new Error(`OpenRouter ${model} ${res.status}: ${err.slice(0, 180)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenRouter ${model} returned empty text`);
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const userText = (
      body.message ||
      body.prompt ||
      body.question ||
      body.doubt ||
      body.text ||
      body.query ||
      ""
    ).toString().trim();

    const mode = body.mode || "chat";
    const images = extractImages(body);
    const hasImages = images.length > 0;

    if (!userText && !hasImages) {
      return NextResponse.json(
        { reply: "Kripya koi sawal likhein ya photo attach karein." },
        { status: 200 }
      );
    }

    const geminiKeys = mode === "live" ? getLiveGeminiKeys() : getChatGeminiKeys();
    
    // 1. Exact model requested by Google in the error message!
    const geminiModels = ["gemini-3.8-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash"];

    // 2. Exact universal models supported on Groq
    const groqModels = hasImages
      ? ["llama-3.2-11b-vision-preview"]
      : ["llama-3.1-8b-instant", "llama3-8b-8192"];

    // 3. Exact slug recommended by OpenRouter in the error message!
    const orModels = [
      "meta-llama/llama-3.3-70b-instruct",
      "meta-llama/llama-3.1-8b-instruct:free",
      "google/gemini-2.0-flash-exp:free",
    ];

    const errorLogs: string[] = [];

    // TIER 1 & 2: Chat Gemini Keys with Google's updated gemini-3.8-flash
    if (geminiKeys.length === 0) {
      errorLogs.push("No Gemini Chat Keys found in environment");
    } else {
      for (const key of geminiKeys) {
        for (const model of geminiModels) {
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
    }

    // TIER 3: Groq Fallback with working llama-3.1-8b-instant
    const groqKey = getGroqKey();
    if (!groqKey) {
      errorLogs.push("No Groq key configured");
    } else {
      for (const model of groqModels) {
        try {
          const reply = await tryGroq(groqKey, model, userText, images);
          return NextResponse.json({ reply, provider: `groq-${model}` });
        } catch (err: any) {
          errorLogs.push(err?.message || String(err));
        }
      }
    }

    // TIER 4: OpenRouter Fallback with recommended slug
    const orKey = getOpenRouterKey();
    if (!orKey) {
      errorLogs.push("No OpenRouter key configured");
    } else {
      for (const model of orModels) {
        try {
          const reply = await tryOpenRouter(orKey, model, userText, images);
          return NextResponse.json({ reply, provider: `openrouter-${model}` });
        } catch (err: any) {
          errorLogs.push(err?.message || String(err));
        }
      }
    }

    // If still fails, show exact reasons
    const diagnosticText = errorLogs.length > 0
      ? errorLogs.slice(0, 3).join("\n• ")
      : "All AI providers temporarily busy.";

    return NextResponse.json(
      {
        reply: `⚠️ AI Faculty Connection Issue:\n• ${diagnosticText}`,
      },
      { status: 200 }
    );
  } catch (globalErr: any) {
    return NextResponse.json(
      { reply: `Sawal samajhne mein dikkat aayi: ${globalErr?.message || String(globalErr)}` },
      { status: 200 }
    );
  }
}
