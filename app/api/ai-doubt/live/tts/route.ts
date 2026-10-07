import { NextRequest, NextResponse } from "next/server";
import { getLiveGeminiKeys, getImageGeminiKeys, getGroqKey } from "@/lib/ai-key-manager";

export const runtime = "edge";

const LIVE_FACULTY_PROMPT = `Tu PrepWise ka real-time Live Video AI Faculty mentor hai for JEE, NEET aur Board exams.
Student ne live video call par camera se apna textbook, handwritten notes, ray diagram, numerical problem ya question dikhaya hai aur doubt pucha hai.

IMPORTANT TEACHER GUIDELINES:
1. DYNAMIC LENGTH & COMPLETE SOLUTIONS (NO ARTIFICIAL RESTRICTIONS):
   - Agar student ne koi bada derivation (jaise Compound Microscope, Astronomical Telescope), optics ray diagram, physics numerical problem, ya derivation dikhaya hai, toh pura PROPER, REASONABLE aur STEP-BY-STEP complete solution samjhao.
   - Har zaroori formula (jaise objective lens magnification Mo = vo/uo, eyepiece Me = 1 + D/fe, total magnification M, cases for near point D aur infinity), steps aur ray diagram ka significance clearly explain karo.
   - Har step ko clean 'Step 1', 'Step 2' ki tarah likho taaki student ko padhne mein bilkul aasani ho.
   - Agar chhota sawal hai, toh 2-3 lines mein crisp explain karo.
2. NATURAL INDIAN FACULTY TONE:
   - Ek experienced, supportive Kota/Delhi top faculty ki tarah natural Hinglish mein explain karo (jaise: "Dekhiye bacchon, is derivation mein...").
3. SPOKEN MATH PHONETICS:
   - Formulas ko natural readable words mein likho taaki bolne aur sunne mein bilkul clear ho (jaise: "M = (vo / uo) * (1 + D / fe)", "under-root", "v = u + a t").
4. CLEAN FORMATTING:
   - Equations aur steps ko separate lines par likho taaki UI mein clean cards ban sakein.`;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let lastGoogleError = "";

  try {
    const { frame, message, studentContext } = await req.json();

    if (!frame && !message) {
      return NextResponse.json(
        { reply: "Kripya camera se question ya notes dikhayein aur puchein." },
        { status: 400 }
      );
    }

    let promptText = message || "Camera par jo handwritten notes ya question hai use step-by-step explain kijiye.";
    if (studentContext?.targetExam) {
      promptText = `[Student Target: ${studentContext.targetExam}] ${promptText}`;
    }

    let rawBase64 = "";
    if (frame && typeof frame === "string") {
      const commaIdx = frame.indexOf(",");
      rawBase64 = commaIdx !== -1 ? frame.slice(commaIdx + 1) : frame;
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 1: GOOGLE GEMINI VISION (Ultra-Fast 3.8s Timeout, Active Models)
    // ─────────────────────────────────────────────────────────────
    let keys = getLiveGeminiKeys();
    if (keys.length === 0) {
      keys = getImageGeminiKeys();
    }
    const envGemini = process.env.GEMINI_API_KEY?.replace(/["'\r\n]/g, "").trim();
    if (envGemini && !keys.includes(envGemini)) {
      keys.push(envGemini);
    }

    // Active stable endpoints first
    const googleModels = ["gemini-flash-latest", "gemini-3.8-flash", "gemini-2.5-flash-lite"];

    if (keys.length > 0) {
      const maxKeyAttempts = Math.min(keys.length, 2);

      for (let i = 0; i < maxKeyAttempts; i++) {
        const key = keys[i];

        for (const modelName of googleModels.slice(0, 2)) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3800);

          try {
            const parts: any[] = [{ text: promptText }];
            if (rawBase64) {
              parts.push({
                inlineData: {
                  mimeType: "image/jpeg",
                  data: rawBase64,
                },
              });
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
            const res = await fetch(url, {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: LIVE_FACULTY_PROMPT }] },
                contents: [{ parts }],
                generationConfig: {
                  temperature: 0.35,
                  maxOutputTokens: 1200,
                },
              }),
            });
            clearTimeout(timeout);

            if (res.ok) {
              const data = await res.json();
              const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (reply) {
                return NextResponse.json({
                  reply,
                  model: `Google Gemini (${modelName})`,
                  provider: "google",
                  success: true,
                  latencyMs: Date.now() - startTime,
                });
              }
            } else {
              let errDetail = "";
              try {
                const errJson = await res.json();
                errDetail = errJson?.error?.message || "";
              } catch (_) {
                errDetail = res.statusText;
              }
              lastGoogleError = `${modelName} returned HTTP ${res.status}: ${errDetail.slice(0, 100)}`;
              
              if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 429) {
                break;
              }
            }
          } catch (e: any) {
            clearTimeout(timeout);
            lastGoogleError = e?.name === "AbortError" ? `${modelName} timed out (>3.8s)` : (e?.message || "Google connection failed");
            break;
          }
        }
      }
    } else {
      lastGoogleError = "No Gemini API keys configured in environment";
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: GROQ MULTIMODAL LPU FAILOVER (~1.2s response)
    // ─────────────────────────────────────────────────────────────
    const groqKey =
      process.env.GROQ_API_KEY_LIVE?.replace(/["'\r\n]/g, "").trim() ||
      getGroqKey();

    if (groqKey) {
      const groqController = new AbortController();
      const groqTimeout = setTimeout(() => groqController.abort(), 4500);

      try {
        const groqContent: any[] = [{ type: "text", text: promptText }];
        if (rawBase64) {
          groqContent.push({
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${rawBase64}`,
            },
          });
        }

        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          signal: groqController.signal,
          headers: {
            Authorization: `Bearer ${groqKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages: [
              { role: "system", content: LIVE_FACULTY_PROMPT },
              { role: "user", content: groqContent },
            ],
            temperature: 0.35,
            max_tokens: 1200,
          }),
        });
        clearTimeout(groqTimeout);

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const groqReply = groqData?.choices?.[0]?.message?.content?.trim();
          if (groqReply) {
            return NextResponse.json({
              reply: groqReply,
              model: "Groq Live LPU (qwen3.8-27b)",
              provider: "groq",
              success: true,
              failoverReason: lastGoogleError ? `Google Failover: ${lastGoogleError}` : undefined,
              latencyMs: Date.now() - startTime,
            });
          }
        }
      } catch (err: any) {
        clearTimeout(groqTimeout);
      }
    }

    return NextResponse.json(
      {
        reply: `Network connection slow hai ya provider unavailable hai. Kripya dubara puchiye. (${lastGoogleError || "Server busy"}).`,
        success: false,
        failoverReason: lastGoogleError,
        latencyMs: Date.now() - startTime,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { reply: `Sawal process karne mein dikkat aayi: ${err?.message || String(err)}`, success: false },
      { status: 500 }
    );
  }
}
