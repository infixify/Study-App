import { NextRequest, NextResponse } from "next/server";
import { getLiveGeminiKeys, getImageGeminiKeys, getGroqKey } from "@/lib/ai-key-manager";

export const runtime = "edge";

const LIVE_FACULTY_PROMPT = `Tu PrepWise ka real-time Live Video AI Faculty mentor hai for JEE, NEET aur Board exams.
Student ne live video call par camera se apna textbook, handwritten notes, ray diagram, numerical problem ya question dikhaya hai aur doubt pucha hai.

IMPORTANT TEACHER GUIDELINES:
1. DYNAMIC LENGTH & COMPLETE SOLUTIONS (NO ARTIFICIAL RESTRICTIONS):
   - Agar student ne koi bada derivation (jaise Compound Microscope, Astronomical Telescope), optics ray diagram, physics numerical problem, ya derivation dikhaya hai, toh pura PROPER, REASONABLE aur STEP-BY-STEP complete solution samjhao.
   - Har zaroori formula (jaise objective lens magnification Mo = vo/uo, eyepiece Me = 1 + D/fe, total magnification M, cases for near point D aur infinity), steps aur ray diagram ka significance clearly explain karo.
   - Agar chhota factual sawal hai, toh 2-3 lines mein crisp explain karo.
   - Solution ko zabardasti aadha ya cut-off mat karo. Student ko pura concept samajh aana chahiye.
2. NATURAL INDIAN FACULTY TONE:
   - Ek experienced, supportive Kota/Delhi top faculty ki tarah natural Hinglish mein explain karo (jaise: "Dekhiye bacchon, is page par Compound Microscope ka derivation hai...").
3. SPOKEN MATH PHONETICS:
   - Formulas ko natural readable words mein likho taaki bolne aur sunne mein bilkul clear ho (jaise: "M barabar L upon fo into 1 plus D upon fe", "vo upon uo", "v equals u plus a t", "under-root").
4. CLEAN PARAGRAPH FORMATTING:
   - Bold asterisks (**), bullets (*), ya raw LaTeX delimiters ($) ki jagah clean paragraphs aur step-by-step readable text use karo.`;

export async function POST(req: NextRequest) {
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
    // TIER 1: GOOGLE 5-KEY POOL + 2-MODEL SAME-KEY CIRCUIT BREAKER
    // ─────────────────────────────────────────────────────────────
    let keys = getLiveGeminiKeys();
    if (keys.length === 0) {
      keys = getImageGeminiKeys();
    }

    let lastGoogleError = "";
    let googleCircuitBroken = false;

    if (keys.length > 0) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const controller1 = new AbortController();
        const timeout1 = setTimeout(() => controller1.abort(), 6500);

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

          const url1 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`;
          const res1 = await fetch(url1, {
            method: "POST",
            signal: controller1.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: LIVE_FACULTY_PROMPT }] },
              contents: [{ parts }],
              generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 1200, // Reasonable capacity for full derivations
              },
            }),
          });
          clearTimeout(timeout1);

          if (res1.ok) {
            const data1 = await res1.json();
            const reply = data1?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (reply) {
              return NextResponse.json({
                reply,
                model: "Gemini Live (gemini-3.8-flash)",
                provider: "google",
                success: true,
              });
            }
          }

          if (res1.status === 429) {
            lastGoogleError = `Key ${i + 1} Quota Exhausted`;
            continue;
          }

          if (res1.status === 503 || res1.status === 500 || res1.status === 502) {
            lastGoogleError = `Model 1 Spike (${res1.status})`;
            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 4500);
            try {
              const url2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`;
              const res2 = await fetch(url2, {
                method: "POST",
                signal: controller2.signal,
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
              clearTimeout(timeout2);
              if (res2.ok) {
                const data2 = await res2.json();
                const reply2 = data2?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (reply2) {
                  return NextResponse.json({
                    reply: reply2,
                    model: "Gemini Live (gemini-3.5-flash-lite)",
                    provider: "google",
                    success: true,
                  });
                }
              }
              if (res2.status === 503 || res2.status === 500 || res2.status === 502) {
                googleCircuitBroken = true;
                break;
              }
            } catch (err2: any) {
              clearTimeout(timeout2);
              googleCircuitBroken = true;
              break;
            }
          }
        } catch (e1: any) {
          clearTimeout(timeout1);
          lastGoogleError = e1?.message || "Model 1 Timeout";
        }
        if (googleCircuitBroken) break;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: GROQ MULTIMODAL LPU FAILOVER
    // ─────────────────────────────────────────────────────────────
    const groqKey =
      process.env.GROQ_API_KEY_LIVE?.replace(/["'\r\n]/g, "").trim() ||
      getGroqKey();

    if (groqKey) {
      const groqController = new AbortController();
      const groqTimeout = setTimeout(() => groqController.abort(), 6000);
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
            });
          }
        }
      } catch (_) {
        clearTimeout(groqTimeout);
      }
    }

    return NextResponse.json(
      {
        reply: `Network connection slow hai. Kripya sawal dubara puchiye (${lastGoogleError || "Server busy"}).`,
        success: false,
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
