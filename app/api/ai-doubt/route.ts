import { NextRequest, NextResponse } from "next/server";
import {
  getChatGeminiKeys,
  getGroqKey,
  getCloudflareWorkersAiConfig,
  getOpenRouterKey,
} from "@/lib/ai-key-manager";

export const runtime = "edge";

// 1. GROQ PROVIDER (Priority 1 - Tested Active Free Models)
async function callGroq(
  prompt: string,
  hasImages: boolean,
  base64Images: { mimeType: string; data: string }[],
  systemPrompt: string
): Promise<string> {
  const apiKey = getGroqKey();
  if (!apiKey) throw new Error("Groq API key missing");

  const cleanKey = apiKey.replace(/["'\r\n]/g, "").trim();

  // Active production free models on Groq
  const modelsToTry = hasImages
    ? ["llama-3.2-11b-vision-preview"]
    : ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile"];

  let lastErr = "";
  for (const model of modelsToTry) {
    try {
      let content: any = prompt;
      if (hasImages) {
        const parts: any[] = [{ type: "text", text: prompt }];
        for (const img of base64Images) {
          parts.push({
            type: "image_url",
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          });
        }
        content = parts;
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          "Content-Type": "application/json",
          "User-Agent": "PrepWise/1.0",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `Groq ${model} ${res.status}: ${errText.slice(0, 100)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }

  throw new Error(lastErr || "All Groq models failed");
}

// 2. CLOUDFLARE WORKERS AI (Priority 2 - 100% Free Edge Llama 3.1 & Mistral)
async function callCloudflareWorkersAi(prompt: string, systemPrompt: string): Promise<string> {
  const config = getCloudflareWorkersAiConfig();
  if (!config) throw new Error("Cloudflare Workers AI credentials missing");

  const cfModels = [
    "@cf/meta/llama-3.1-8b-instruct",
    "@cf/mistral/mistral-7b-instruct-v0.1",
  ];

  let lastErr = "";
  for (const model of cfModels) {
    try {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${model}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `WorkersAI ${model} ${res.status}: ${errText.slice(0, 100)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.result?.response?.trim();
      if (text) return text;
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }

  throw new Error(lastErr || "Workers AI failed");
}

// 3. GOOGLE GEMINI (Priority 3 - Multimodal Reasoning)
async function callGemini(
  prompt: string,
  base64Images: { mimeType: string; data: string }[],
  systemPrompt: string
): Promise<string> {
  const keys = getChatGeminiKeys();
  if (keys.length === 0) throw new Error("No Gemini Chat keys configured");

  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastErr = "";

  for (const rawKey of keys) {
    const key = rawKey.replace(/["'\r\n]/g, "").trim();
    for (const model of models) {
      try {
        const parts: any[] = [{ text: prompt }];
        for (const img of base64Images) {
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.data,
            },
          });
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts }],
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          lastErr = `Gemini ${model} ${res.status}: ${errBody.slice(0, 100)}`;
          continue;
        }

        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } catch (e: any) {
        lastErr = e?.message || String(e);
      }
    }
  }

  throw new Error(lastErr || "All Gemini keys failed");
}

// 4. OPENROUTER (Priority 4 - Final Fallback)
async function callOpenRouter(
  prompt: string,
  hasImages: boolean,
  base64Images: { mimeType: string; data: string }[],
  systemPrompt: string
): Promise<string> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) throw new Error("OpenRouter API key missing");

  const cleanKey = apiKey.replace(/["'\r\n]/g, "").trim();
  const models = hasImages
    ? ["google/gemini-2.0-flash-001", "meta-llama/llama-3.2-11b-vision-instruct:free"]
    : ["meta-llama/llama-3.1-8b-instruct:free", "mistralai/mistral-7b-instruct:free"];

  let lastErr = "";
  for (const model of models) {
    try {
      let content: any = prompt;
      if (hasImages) {
        content = [{ type: "text", text: prompt }];
        for (const img of base64Images) {
          content.push({
            type: "image_url",
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          });
        }
      }

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://eterprep.pages.dev",
          "X-Title": "PrepWise AI Doubt",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content },
          ],
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        lastErr = `OpenRouter ${model} ${res.status}: ${errText.slice(0, 100)}`;
        continue;
      }

      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }

  throw new Error(lastErr || "All OpenRouter models failed");
}

// MAIN POST ROUTE
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = (body.message || body.prompt || body.question || "").trim();
    const images: string[] = Array.isArray(body.images) ? body.images : [];
    const studentContext = body.studentContext || null;

    // Build Personalized Academic Prompt
    let contextAddition = "";
    if (studentContext) {
      const studentName = studentContext.name || "Student";
      const targetExam = studentContext.targetExam || "JEE/NEET";
      const daysLeft = studentContext.daysToExam ? `${studentContext.daysToExam} days left` : "";
      const weakSubs = Array.isArray(studentContext.weakSubjects)
        ? studentContext.weakSubjects.join(", ")
        : "";

      contextAddition = `\nSTUDENT PROFILE:
- Name: ${studentName}
- Target Exam: ${targetExam} ${daysLeft ? `(${daysLeft})` : ""}
- Identified Weak Areas: ${weakSubs || "None reported"}
RULE: Agar student kisi weak area se related sawal puche, toh step-by-step extra conceptual foundation aur encouragement do.`;
    }

    const SYSTEM_PROMPT = `Tu PrepWise ka highly qualified Senior Academic Faculty hai jo JEE, NEET, aur Boards ke students ko padhata hai.
RULES FOR PERFECT ANSWERS:
1. Academic Accuracy: Pure NCERT aur Standard Indian Syllabus ke authentic facts aur accurate definitions use kar (jaise Koshika = Cell, Jeevan ki moolbhoot sanrachnatmak aur kriyatmak ikai / Structural and functional unit of life). Faltu ya ajeeb translations bilkul mat kar.
2. Clean Formatting:
   - Headings ko **Heading Name** karke likh (e.g. **Paribhasha (Definition)**, **Mukhya Bindu**, **Udaharan**).
   - Steps ko 'Step 1:', 'Step 2:' karke likh.
   - Bullet points ke liye '- ' use kar.
   - Formula ya Important baat ke liye 'Formula:' ya 'Important:' prefix use kar.
3. Math & Science Symbols: Clean readable Unicode text use kar jaise x² + y² = r², √(49) = 7, a/b, ±, →, °C. Kabhi bhi LaTeX delimiters ($ ya $$ ya \\frac) mat use kar.
4. Tone: Helpful, motivating, aur clear student-friendly Hinglish. Seedha to-the-point solution de.${contextAddition}`;

    // Fast base64 parsing without regex backtracking
    const base64Images: { mimeType: string; data: string }[] = [];
    for (const raw of images) {
      if (typeof raw === "string" && raw.startsWith("data:")) {
        const commaIdx = raw.indexOf(",");
        if (commaIdx !== -1) {
          const header = raw.slice(5, commaIdx);
          const mimeType = header.split(";")[0] || "image/jpeg";
          const data = raw.slice(commaIdx + 1);
          if (data.length > 50) {
            base64Images.push({ mimeType, data });
          }
        }
      }
    }

    const hasImages = base64Images.length > 0;
    const finalPrompt =
      prompt ||
      (hasImages
        ? "Kripya is photo mein diye gaye sawal ko step-by-step solve kijiye."
        : "");

    if (!finalPrompt) {
      return NextResponse.json(
        { reply: "Kripya koi sawal likhein ya photo attach karein." },
        { status: 200 }
      );
    }

    const errors: string[] = [];

    // 1. GROQ (Priority 1)
    try {
      const reply = await callGroq(finalPrompt, hasImages, base64Images, SYSTEM_PROMPT);
      return NextResponse.json({ reply, provider: "groq" }, { status: 200 });
    } catch (e: any) {
      errors.push(`Groq: ${e.message}`);
    }

    // 2. CLOUDFLARE WORKERS AI (Priority 2 - Text doubts)
    if (!hasImages) {
      try {
        const reply = await callCloudflareWorkersAi(finalPrompt, SYSTEM_PROMPT);
        return NextResponse.json({ reply, provider: "cloudflare_workers_ai" }, { status: 200 });
      } catch (e: any) {
        errors.push(`WorkersAI: ${e.message}`);
      }
    }

    // 3. GOOGLE GEMINI (Priority 3 - Multimodal Reasoning)
    try {
      const reply = await callGemini(finalPrompt, base64Images, SYSTEM_PROMPT);
      return NextResponse.json({ reply, provider: "gemini" }, { status: 200 });
    } catch (e: any) {
      errors.push(`Gemini: ${e.message}`);
    }

    // 4. OPENROUTER (Priority 4 - Safety Net)
    try {
      const reply = await callOpenRouter(finalPrompt, hasImages, base64Images, SYSTEM_PROMPT);
      return NextResponse.json({ reply, provider: "openrouter" }, { status: 200 });
    } catch (e: any) {
      errors.push(`OpenRouter: ${e.message}`);
    }

    // If all fail
    return NextResponse.json(
      {
        reply: `⚠️ Sabhi AI Providers connect nahi ho paaye:\n• ${errors.join("\n• ")}`,
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
