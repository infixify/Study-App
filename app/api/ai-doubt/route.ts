import { NextRequest, NextResponse } from "next/server";
import {
  getImageGeminiKeys,
  getChatGeminiKeys,
  getGroqKey,
  getSambaNovaKey,
  getCloudflareWorkersAiConfig,
  getCloudflareImageAiConfig,
  getOpenRouterKey,
} from "@/lib/ai-key-manager";

export const runtime = "edge";

const BASE_PROMPT = `Tu PrepWise ka highly qualified Senior Academic Faculty hai jo JEE, NEET aur Boards padhata hai.
RULES FOR PERFECT ANSWERS:
1. Academic Accuracy: NCERT aur standard formulas use kar (e.g. Koshika = Cell, Jeevan ki buniyadi ikai).
2. Clean Formatting:
   - Headings ko **Heading Name** karke likh.
   - Steps ko 'Step 1:', 'Step 2:' likh.
   - Formula ya Note ke liye 'Formula:' ya 'Important:' likh.
   - Points ke liye '- ' bullet use kar.
3. Math Symbols: Clean Unicode use kar (x², √(49)=7, a/b, ±, →, °C). LaTeX delimiters ($ ya $$ ya \\frac) mat use kar.
4. Tone: Helpful aur clear Hinglish. Seedha step-by-step solution de.`;

interface ImagePart {
  mimeType: string;
  data: string;
}

// ---------------- VISION CALLERS ----------------

// 1. Google Gemini Vision (Priority 1 for Images)
async function callGeminiVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const keys = getImageGeminiKeys();
  if (keys.length === 0) throw new Error("No Gemini Image key found");

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErr = "";

  for (const key of keys) {
    for (const model of models) {
      try {
        const parts: any[] = [{ text: prompt }];
        for (const img of images) {
          parts.push({
            inlineData: { mimeType: img.mimeType, data: img.data }
          });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: BASE_PROMPT }] },
            contents: [{ parts }]
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
          continue;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return { reply: text, model };
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }
  }
  throw new Error(lastErr || "Gemini Vision failed");
}

// 2. Groq Vision
async function callGroqVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("Groq API key missing");

  const models = ["llama-3.2-11b-vision-preview", "llama-3.2-90b-vision-preview"];
  const userContent: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    });
  }

  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: userContent }
          ],
          temperature: 0.2,
          max_tokens: 1500
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Groq Vision failed");
}

// 3. SambaNova Cloud Vision
async function callSambaNovaVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getSambaNovaKey();
  if (!apiKey) throw new Error("SambaNova API key missing");

  const model = "Llama-3.2-11B-Vision-Instruct";
  const userContent: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    });
  }

  const res = await fetch("https://api.sambanova.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: BASE_PROMPT },
        { role: "user", content: userContent }
      ],
      temperature: 0.2,
      max_tokens: 1500
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`SambaNova ${res.status}: ${errText.slice(0, 90)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("SambaNova returned empty response");
  return { reply: text, model };
}

// 4. Cloudflare Workers AI Vision (Account 2)
async function callCloudflareWorkersAiVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const config = getCloudflareImageAiConfig();
  if (!config) throw new Error("Cloudflare Vision credentials missing");

  const model = "@cf/meta/llama-3.2-11b-vision-instruct";
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;

  // Pass base64 image data to Workers AI
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${config.apiToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      prompt: `${BASE_PROMPT}\n\nQuestion: ${prompt}`,
      image: images[0]?.data ? Array.from(Buffer.from(images[0].data, "base64")) : undefined
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WorkersAI Vision ${res.status}: ${errText.slice(0, 90)}`);
  }

  const data = await res.json();
  const text = data?.result?.response?.trim();
  if (!text) throw new Error("WorkersAI Vision empty reply");
  return { reply: text, model };
}

// 5. OpenRouter Vision
async function callOpenRouterVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) throw new Error("OpenRouter API key missing");

  const models = ["google/gemini-2.0-flash-001", "meta-llama/llama-3.2-11b-vision-instruct:free"];
  const userContent: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    });
  }

  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://eterprep.pages.dev",
          "X-Title": "PrepWise AI Doubt"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: userContent }
          ],
          temperature: 0.2
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "OpenRouter Vision failed");
}

// ---------------- TEXT-ONLY CALLERS ----------------

async function callGroqText(prompt: string): Promise<{ reply: string; model: string }> {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("Groq API key missing");

  const models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"];
  let lastErr = "";

  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1500
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Groq Text failed");
}

async function callWorkersAiText(prompt: string): Promise<{ reply: string; model: string }> {
  const config = getCloudflareWorkersAiConfig();
  if (!config) throw new Error("Cloudflare Text AI credentials missing");

  const models = ["@cf/meta/llama-3.1-8b-instruct", "@cf/mistral/mistral-7b-instruct-v0.1"];
  let lastErr = "";

  for (const model of models) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: BASE_PROMPT },
            { role: "user", content: prompt }
          ]
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.result?.response?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Workers AI Text failed");
}

// ---------------- MAIN ROUTE HANDLER ----------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body.message || body.prompt || body.question || "").trim();
    const images: string[] = Array.isArray(body.images) ? body.images : [];

    // Safe base64 substring parser
    const base64Images: ImagePart[] = [];
    for (const raw of images) {
      if (typeof raw === "string" && raw.startsWith("data:")) {
        const commaIdx = raw.indexOf(",");
        if (commaIdx !== -1) {
          const mimeType = raw.slice(5, commaIdx).split(";")[0] || "image/jpeg";
          const data = raw.slice(commaIdx + 1);
          if (data.length > 50) {
            base64Images.push({ mimeType, data });
          }
        }
      }
    }

    const hasImages = base64Images.length > 0;
    const finalPrompt = prompt || (hasImages ? "Kripya is photo mein diye gaye sawal ko step-by-step solve kijiye." : "");

    if (!finalPrompt) {
      return NextResponse.json(
        { reply: "Kripya koi sawal likhein ya photo attach karein." },
        { status: 200 }
      );
    }

    const attemptsTrace: string[] = [];

    // ==========================================
    // CASE A: IMAGE + TEXT DOUBTS (VISION FLOW)
    // ==========================================
    if (hasImages) {
      // 1. Gemini Vision (Dedicated Image Key)
      try {
        const { reply, model } = await callGeminiVision(finalPrompt, base64Images);
        attemptsTrace.push(`Gemini: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "gemini", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Gemini: Failed (${e.message})`);
      }

      // 2. Groq Vision
      try {
        const { reply, model } = await callGroqVision(finalPrompt, base64Images);
        attemptsTrace.push(`Groq Vision: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "groq", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Groq Vision: Failed (${e.message})`);
      }

      // 3. SambaNova Cloud Vision
      try {
        const { reply, model } = await callSambaNovaVision(finalPrompt, base64Images);
        attemptsTrace.push(`SambaNova: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "sambanova", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`SambaNova: Failed (${e.message})`);
      }

      // 4. Cloudflare Workers AI Vision (Account 2)
      try {
        const { reply, model } = await callCloudflareWorkersAiVision(finalPrompt, base64Images);
        attemptsTrace.push(`WorkersAI Vision: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "cloudflare_vision", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`WorkersAI Vision: Failed (${e.message})`);
      }

      // 5. OpenRouter Vision
      try {
        const { reply, model } = await callOpenRouterVision(finalPrompt, base64Images);
        attemptsTrace.push(`OpenRouter: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "openrouter", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`OpenRouter: Failed (${e.message})`);
      }
    }

    // ==========================================
    // CASE B: PURE TEXT DOUBTS (TEXT FLOW)
    // ==========================================
    else {
      // 1. Groq Text
      try {
        const { reply, model } = await callGroqText(finalPrompt);
        attemptsTrace.push(`Groq: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "groq", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Groq: Failed (${e.message})`);
      }

      // 2. Cloudflare Workers AI Text (Account 1)
      try {
        const { reply, model } = await callWorkersAiText(finalPrompt);
        attemptsTrace.push(`WorkersAI: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "cloudflare_workers_ai", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`WorkersAI: Failed (${e.message})`);
      }

      // 3. Google Gemini Text
      try {
        const { reply, model } = await callGeminiVision(finalPrompt, []);
        attemptsTrace.push(`Gemini: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "gemini", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Gemini: Failed (${e.message})`);
      }

      // 4. OpenRouter Text
      try {
        const { reply, model } = await callOpenRouterVision(finalPrompt, []);
        attemptsTrace.push(`OpenRouter: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "openrouter", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`OpenRouter: Failed (${e.message})`);
      }
    }

    // If all providers fail, return clean transparent diagnostic
    return NextResponse.json(
      {
        reply: `⚠️ Sabhi AI Providers connect nahi ho paaye:\n• ${attemptsTrace.join("\n• ")}`,
        debugTrace: attemptsTrace
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { reply: `Sawal process karne mein dikkat aayi: ${err?.message || String(err)}` },
      { status: 200 }
    );
  }
}
