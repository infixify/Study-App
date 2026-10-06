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
1. Academic Accuracy: Pure NCERT aur standard formulas use kar (jaise Koshika = Cell, Jeevan ki buniyadi ikai).
2. Clean Formatting:
   - Headings ko **Heading Name** karke likh.
   - Steps ko 'Step 1:', 'Step 2:' likh.
   - Formula ya Note ke liye 'Formula:' ya 'Important:' likh.
   - Points ke liye '- ' bullet use kar.
3. Math Symbols: Clean Unicode use kar (x², √(49)=7, a/b, ±, →, °C). LaTeX delimiters ($ ya $$ ya \\frac) mat use kar.
4. Tone: Helpful aur clear Hinglish. Seedha to-the-point solution de.`;

interface ImagePart {
  mimeType: string;
  data: string;
}

// Helper to convert base64 to byte array in Edge runtime without Node Buffer
function base64ToUint8Array(base64: string): number[] {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return Array.from(bytes);
  } catch {
    return [];
  }
}

// ---------------- VISION PROVIDERS (IMAGE + TEXT) ----------------

// 1. Google Gemini Vision (Active 2026 Models: gemini-3.8-flash & gemini-3.5-flash-lite)
async function callGeminiVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const keys = getImageGeminiKeys();
  if (keys.length === 0) throw new Error("Gemini Image key missing");

  const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"];
  let lastErr = "";

  for (const key of keys) {
    for (const model of models) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

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
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: BASE_PROMPT }] },
            contents: [{ parts }]
          })
        });

        clearTimeout(timeoutId);

        // Immediate skip on server overload spike
        if (res.status === 503 || res.status === 429) {
          lastErr = `${model} Busy (${res.status})`;
          break; // Skip to next provider immediately
        }

        if (!res.ok) {
          const errText = await res.text();
          lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
          continue;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return { reply: text, model };
      } catch (e: any) {
        clearTimeout(timeoutId);
        lastErr = e.name === "AbortError" ? `${model} Timeout (>4.5s)` : e?.message || String(e);
      }
    }
  }
  throw new Error(lastErr || "Gemini Vision failed");
}

// 2. Groq Multimodal Vision (Active 2026 Model: qwen/qwen3.8-27b)
async function callGroqVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("Groq API key missing");

  const model = "qwen/qwen3.8-27b";
  const userContent: any[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` }
    });
  }

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
    throw new Error(`Groq ${res.status}: ${errText.slice(0, 90)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq Vision empty reply");
  return { reply: text, model };
}

// 3. SambaNova Cloud Vision (Active 2026 Models with 'Meta-' prefix)
async function callSambaNovaVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getSambaNovaKey();
  if (!apiKey) throw new Error("SambaNova API key missing");

  const models = ["Meta-Llama-3.2-11B-Vision-Instruct", "Meta-Llama-3.2-90B-Vision-Instruct"];
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
  throw new Error(lastErr || "SambaNova Vision failed");
}

// 4. Cloudflare Workers AI Vision (Account 2: Llama 3.2 Vision + Llava 1.5)
async function callCloudflareWorkersAiVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const config = getCloudflareImageAiConfig();
  if (!config) throw new Error("Cloudflare Vision credentials missing");

  const models = ["@cf/meta/llama-3.2-11b-vision-instruct", "@cf/llava-hf/llava-1.5-7b-hf"];
  const imageBytes = images[0]?.data ? base64ToUint8Array(images[0].data) : [];

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
          prompt: `${BASE_PROMPT}\n\nQuestion: ${prompt}`,
          image: imageBytes.length > 0 ? imageBytes : undefined
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `${model} ${res.status}: ${errText.slice(0, 90)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.result?.response?.trim() || data?.result?.description?.trim();
      if (text) return { reply: text, model };
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr || "Cloudflare Vision failed");
}

// 5. OpenRouter Free Vision (openrouter/free & qwen-2.5-vl)
async function callOpenRouterVision(prompt: string, images: ImagePart[]): Promise<{ reply: string; model: string }> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) throw new Error("OpenRouter API key missing");

  const models = ["openrouter/free", "qwen/qwen-2.5-vl-7b-instruct:free"];
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

// ---------------- TEXT-ONLY PROVIDERS (UNTOUCHED & PRESERVED) ----------------

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

// ---------------- MAIN ROUTE POST HANDLER ----------------

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body.message || body.prompt || body.question || "").trim();
    const images: string[] = Array.isArray(body.images) ? body.images : [];

    // Safe base64 substring parser (zero regex catastrophic backtracking)
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
    // CASE A: IMAGE + TEXT (VISION FLOW - 5 PROVIDERS)
    // ==========================================
    if (hasImages) {
      // 1. Google Gemini Vision (gemini-3.8-flash, gemini-3.5-flash-lite)
      try {
        const { reply, model } = await callGeminiVision(finalPrompt, base64Images);
        attemptsTrace.push(`Gemini: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "gemini", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Gemini: ${e.message}`);
      }

      // 2. Groq Multimodal Vision (qwen/qwen3.8-27b)
      try {
        const { reply, model } = await callGroqVision(finalPrompt, base64Images);
        attemptsTrace.push(`Groq Vision: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "groq", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`Groq: ${e.message}`);
      }

      // 3. SambaNova Cloud Vision (Meta-Llama-3.2-11B-Vision-Instruct)
      try {
        const { reply, model } = await callSambaNovaVision(finalPrompt, base64Images);
        attemptsTrace.push(`SambaNova: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "sambanova", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`SambaNova: ${e.message}`);
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
        attemptsTrace.push(`WorkersAI: ${e.message}`);
      }

      // 5. OpenRouter Vision (openrouter/free)
      try {
        const { reply, model } = await callOpenRouterVision(finalPrompt, base64Images);
        attemptsTrace.push(`OpenRouter: Success (${model})`);
        return NextResponse.json(
          { reply, provider: "openrouter", model, debugTrace: attemptsTrace },
          { status: 200 }
        );
      } catch (e: any) {
        attemptsTrace.push(`OpenRouter: ${e.message}`);
      }
    }

    // ==========================================
    // CASE B: PURE TEXT DOUBTS (UNTOUCHED & PRESERVED)
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
        attemptsTrace.push(`Groq: ${e.message}`);
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
        attemptsTrace.push(`WorkersAI: ${e.message}`);
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
        attemptsTrace.push(`Gemini: ${e.message}`);
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
        attemptsTrace.push(`OpenRouter: ${e.message}`);
      }
    }

    // If all fail
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
