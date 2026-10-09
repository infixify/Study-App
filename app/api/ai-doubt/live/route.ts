// app/api/ai-doubt/live/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getLiveGeminiKeys, getImageGeminiKeys, getGroqKey } from "@/lib/ai-key-manager";

export const runtime = "edge";

const LIVE_FACULTY_PROMPT = `Tu PrepWise ka real-time Live Video AI Faculty mentor hai for JEE, NEET aur Board exams.
Student ne live video call par camera se apna textbook, handwritten notes, ray diagram, numerical problem ya question dikhaya hai aur doubt pucha hai.

IMPORTANT TEACHER GUIDELINES:
1. DYNAMIC LENGTH & COMPLETE SOLUTIONS (NO ARTIFICIAL RESTRICTIONS):
   - Agar student ne koi bada derivation (jaise Compound Microscope, Astronomical Telescope), optics ray diagram, physics numerical problem, ya derivation dikhaya hai, toh pura PROPER, REASONABLE aur STEP-BY-STEP complete solution samjhao.
   - Har zaroori formula (jaise objective lens magnification Mo = vo/uo, eyepiece Me = 1 + D/fe, total magnification M, cases for near point D aur infinity), steps aur ray diagram ka significance clearly explain karo.
   - Har step ko clean 'Step 1:', 'Step 2:' format mein likho taaki student ko padhne mein bilkul aasani ho.
   - Agar chhota sawal hai, toh 2-3 lines mein crisp explain karo.
2. NATURAL INDIAN FACULTY TONE:
   - Ek experienced, supportive Kota/Delhi top faculty ki tarah natural Hinglish mein explain karo (jaise: "Dekhiye bacchon, is derivation mein...").
3. SPOKEN MATH PHONETICS:
   - Formulas ko natural readable words aur clean Unicode mein likho (jaise: "Mo = vo / uo", "M = Mo * Me", "under-root", "v = u + a*t").
4. CLEAN FORMATTING:
   - Equations aur steps ko separate lines par likho taaki UI mein clean cards ban sakein.

ANSWER LENGTH RULES (STRICT):
CASE A - SPECIFIC DOUBT (student ne voice/text me koi specific question pucha hai):
- "is step me minus kyu hai", "ye formula kaise aaya", "option C galat kyu hai", "explain this step" jaise specific doubts par SIRF direct, compact, EXACT answer do (2-4 lines maximum).
- Pura solution ya full derivation TAB TAK MAT DO jab tak student explicitly na maange ("solve this completely", "pura solve karo", "give full derivation").
CASE B - FULL SOLUTION (student ne explicitly full solution maanga, ya voice/text input blank hai i.e. sirf camera image scan hui):
- Standard structured Step-by-Step complete solution do (jitna upar guideline 1 me likha hai).

LANGUAGE MATCHING (STRICT):
- Student jis language me doubt pucha hai, usi language me natural faculty tone me answer do (Hinglish -> Hinglish, English -> English, Hindi -> Hindi, etc.). Language change karke answer dena mana hai.

OUTPUT FORMAT (STRICT — follow exactly):
Respond ONLY with a single valid JSON object, no markdown fences, no extra text:
{"reply": "...", "tts_text": "..."}
- "reply": your full answer in the SAME language and script the student used (Hinglish Roman -> Hinglish Roman, English -> English, etc.).
- "tts_text": the SAME answer rewritten for text-to-speech in the NATIVE script of that language (Hinglish/Hindi -> shuddh Devanagari; English -> English; Marathi/Tamil/etc. -> their own script). Keep technical terms (Newton, force, equation, lens) in English. NO markdown, NO LaTeX, NO asterisks. Write formulas as spoken words, e.g. "v equals u plus a t", "under root of 2". Flowing natural speech text only.`;

// Parse Gemini dual-output JSON; fall back to raw text if parsing fails
function parseDual(raw: string): { reply: string; tts_text: string } {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const j = JSON.parse(cleaned.slice(start, end + 1));
      if (j && j.reply) return { reply: String(j.reply), tts_text: j.tts_text ? String(j.tts_text) : String(j.reply) };
    }
  } catch (_) {}
  return { reply: raw, tts_text: raw };
}

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
    if (studentContext?.language) {
      promptText = `[Student Language: ${studentContext.language} — isi language me answer karo] ${promptText}`;
    }

    let rawBase64 = "";
    if (frame && typeof frame === "string") {
      const commaIdx = frame.indexOf(",");
      rawBase64 = commaIdx !== -1 ? frame.slice(commaIdx + 1) : frame;
    }

    // ─────────────────────────────────────────────────────────────
    // 2 KEYS SELECTION: Key 1 & Key 2
    // ─────────────────────────────────────────────────────────────
    let allKeys = getLiveGeminiKeys();
    if (allKeys.length === 0) {
      allKeys = getImageGeminiKeys();
    }
    const envGemini = process.env.GEMINI_API_KEY?.replace(/["'\r\n]/g, "").trim();
    if (envGemini && !allKeys.includes(envGemini)) {
      allKeys.push(envGemini);
    }

    const key1 = allKeys[0] || null;
    const key2 = allKeys[1] || null;

    // Active Models: Image Doubt models (working in production)
    const MODEL_A = "gemini-3.8-flash";
    const MODEL_B = "gemini-3.5-flash-lite";

    // Helper to call Google Gemini
    async function tryGemini(key: string, model: string): Promise<{ ok: boolean; status: number; text?: string; ttsText?: string; err?: string }> {
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

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: LIVE_FACULTY_PROMPT }] },
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 2500,
            },
          }),
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (reply) { const dd = parseDual(reply); return { ok: true, status: 200, text: dd.reply, ttsText: dd.tts_text }; }
        }

        let errDetail = "";
        try {
          const errJson = await res.json();
          errDetail = errJson?.error?.message || "";
        } catch (_) {
          errDetail = res.statusText;
        }
        return { ok: false, status: res.status, err: `${model} HTTP ${res.status}: ${errDetail.slice(0, 90)}` };
      } catch (e: any) {
        clearTimeout(timeout);
        const isTimeout = e?.name === "AbortError";
        return {
          ok: false,
          status: isTimeout ? 408 : 500,
          err: isTimeout ? `${model} Timeout (>3.8s)` : (e?.message || `${model} Connection failed`),
        };
      }
    }

    function isTrafficSpike(status: number): boolean {
      return status === 503 || status === 500 || status === 502 || status === 504 || status === 408;
    }

    function isRateLimit(status: number): boolean {
      return status === 429;
    }

    // ─────────────────────────────────────────────────────────────
    // DUAL-KEY / DUAL-MODEL SMART CIRCUIT-BREAKER LOGIC
    // ─────────────────────────────────────────────────────────────
    if (key1) {
      // 1. Try Model A on Key 1
      const resA1 = await tryGemini(key1, MODEL_A);
      if (resA1.ok && resA1.text) {
        return NextResponse.json({
          reply: resA1.text,
            tts_text: resA1.ttsText,
          model: `Google Gemini (${MODEL_A})`,
          provider: "google",
          success: true,
          latencyMs: Date.now() - startTime,
        });
      }
      lastGoogleError = resA1.err || "Model A failed on Key 1";

      if (isRateLimit(resA1.status)) {
        // Model A got Rate Limited (429) on Key 1: Try Model B on Key 1
        const resB1 = await tryGemini(key1, MODEL_B);
        if (resB1.ok && resB1.text) {
          return NextResponse.json({
            reply: resB1.text,
            tts_text: resB1.ttsText,
            model: `Google Gemini (${MODEL_B})`,
            provider: "google",
            success: true,
            latencyMs: Date.now() - startTime,
          });
        }
        lastGoogleError = resB1.err || "Model B failed on Key 1";

        if (isRateLimit(resB1.status)) {
          // Rule 1: BOTH MODELS RATE LIMIT ON KEY 1 -> TRY BOTH ON KEY 2
          if (key2) {
            const resA2 = await tryGemini(key2, MODEL_A);
            if (resA2.ok && resA2.text) {
              return NextResponse.json({
                reply: resA2.text,
            tts_text: resA2.ttsText,
                model: `Google Gemini (${MODEL_A} - Key 2)`,
                provider: "google",
                success: true,
                latencyMs: Date.now() - startTime,
              });
            }
            lastGoogleError = resA2.err || "Key 2 Model A failed";

            const resB2 = await tryGemini(key2, MODEL_B);
            if (resB2.ok && resB2.text) {
              return NextResponse.json({
                reply: resB2.text,
            tts_text: resB2.ttsText,
                model: `Google Gemini (${MODEL_B} - Key 2)`,
                provider: "google",
                success: true,
                latencyMs: Date.now() - startTime,
              });
            }
            lastGoogleError = resB2.err || "Key 2 Model B failed";
          }
        }
      } else if (isTrafficSpike(resA1.status)) {
        // Model A had Traffic Spike on Key 1 -> TRY MODEL B
        const resB1 = await tryGemini(key1, MODEL_B);
        if (resB1.ok && resB1.text) {
          return NextResponse.json({
            reply: resB1.text,
            tts_text: resB1.ttsText,
            model: `Google Gemini (${MODEL_B})`,
            provider: "google",
            success: true,
            latencyMs: Date.now() - startTime,
          });
        }
        lastGoogleError = resB1.err || "Model B failed on Key 1";

        if (isTrafficSpike(resB1.status)) {
          // Timeout / Traffic Spike on Key 1 -> Fallback to Key 2!
          if (key2) {
            const resA2 = await tryGemini(key2, MODEL_A);
            if (resA2.ok && resA2.text) {
              return NextResponse.json({
                reply: resA2.text,
            tts_text: resA2.ttsText,
                model: `Google Gemini (${MODEL_A} - Key 2)`,
                provider: "google",
                success: true,
                latencyMs: Date.now() - startTime,
              });
            }
            lastGoogleError = resA2.err || "Key 2 Model A failed";

            const resB2 = await tryGemini(key2, MODEL_B);
            if (resB2.ok && resB2.text) {
              return NextResponse.json({
                reply: resB2.text,
            tts_text: resB2.ttsText,
                model: `Google Gemini (${MODEL_B} - Key 2)`,
                provider: "google",
                success: true,
                latencyMs: Date.now() - startTime,
              });
            }
            lastGoogleError = resB2.err || "Key 2 Model B failed";
          }
        } else if (isRateLimit(resB1.status)) {
          // Rule 3: 1st MODEL TRAFFIC ON KEY 1 AND 2nd MODEL RATE LIMIT -> TRY RATE LIMITED MODEL ON KEY 2!
          if (key2) {
            const resB2 = await tryGemini(key2, MODEL_B);
            if (resB2.ok && resB2.text) {
              return NextResponse.json({
                reply: resB2.text,
            tts_text: resB2.ttsText,
                model: `Google Gemini (${MODEL_B} - Key 2)`,
                provider: "google",
                success: true,
                latencyMs: Date.now() - startTime,
              });
            }
            lastGoogleError = resB2.err || "Key 2 Model B rate-limit fallback failed";
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

    let groqFailReason = "";
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
            const gd = parseDual(groqReply);
            return NextResponse.json({
              reply: gd.reply,
              tts_text: gd.tts_text,
              model: "Groq Live LPU (qwen3.8-27b)",
              provider: "groq",
              success: true,
              failoverReason: lastGoogleError ? `Google Failover: ${lastGoogleError}` : undefined,
              latencyMs: Date.now() - startTime,
            });
          }
        } else {
          let errText = "";
          try {
            const errData = await groqRes.json();
            errText = errData?.error?.message || "";
          } catch {
            errText = groqRes.statusText;
          }
          groqFailReason = `Groq HTTP ${groqRes.status}: ${errText.slice(0, 80)}`;
        }
      } catch (err: any) {
        clearTimeout(groqTimeout);
        groqFailReason = err?.name === "AbortError" ? "Groq Timeout (>4.5s)" : (err?.message || "Groq connection error");
      }
    } else {
      groqFailReason = "GROQ_API_KEY_LIVE not configured";
    }

    const finalErrMsg = [lastGoogleError, groqFailReason].filter(Boolean).join(" | ");

    return NextResponse.json(
      {
        reply: `Network connection slow hai ya provider unavailable hai. Kripya dubara puchiye. (${finalErrMsg || "Server busy"}).`,
        success: false,
        failoverReason: finalErrMsg,
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
