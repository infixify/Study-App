import { NextRequest, NextResponse } from "next/server";
import { getLiveGeminiKeys, getImageGeminiKeys, getGroqKey } from "@/lib/ai-key-manager";

export const runtime = "edge";

const LIVE_FACULTY_PROMPT = `Tu PrepWise ka real-time Live Video AI Faculty hai for JEE, NEET aur Board exams.
Student ne video call par camera se apna textbook, notes ya question dikhaya hai aur bol kar doubt pucha hai.

RULES FOR LIVE VIDEO CALL ANSWERS:
1. Short & Direct: Jawab sirf 2 se 4 lines mein clear, to-the-point teacher tone mein de. Faltu introductory ya concluding lines mat bol.
2. Spoken Hinglish: Natural conversational Hinglish mein baat kar jaise ek Kota/Delhi teacher live call par samjhata hai (e.g. "Dekho yahan sabse pehle conservation of energy lagegi...").
3. No Raw LaTeX: Kabhi bhi raw LaTeX delimiters ($ ya \\frac ya \\sqrt) mat use kar. Formulas ko readable Unicode ya plain text mein likh (jaise: v = u + at, F = q(v × B), PV = nRT, ya under-root).
4. Step-by-Step Clarity: Core concept aur final answer turant explain kar.`;

export async function POST(req: NextRequest) {
  try {
    const { frame, message, studentContext } = await req.json();

    if (!frame && !message) {
      return NextResponse.json(
        { reply: "Kripya camera se question dikhayein ya bol kar puchein." },
        { status: 400 }
      );
    }

    let promptText = message || "Camera par jo question hai use step-by-step samjhaiye.";
    if (studentContext?.targetExam) {
      promptText = `[Student Target: ${studentContext.targetExam}] ${promptText}`;
    }

    // Clean base64 frame if provided (Fast slice, zero regex backtracking)
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

        // 1. Try Primary Live Model: gemini-3.8-flash
        const controller1 = new AbortController();
        const timeout1 = setTimeout(() => controller1.abort(), 4500);

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
                maxOutputTokens: 350,
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

          // Handle Rate-Limit 429 -> Rotate to Next Key
          if (res1.status === 429) {
            lastGoogleError = `Key ${i + 1} 429 Quota Exhausted`;
            continue; // Next key
          }

          // If Server Spike (503 / 500 / Overload) -> Try Model 2 on SAME KEY
          if (res1.status === 503 || res1.status === 500 || res1.status === 502) {
            lastGoogleError = `Model 1 Spike (${res1.status})`;

            const controller2 = new AbortController();
            const timeout2 = setTimeout(() => controller2.abort(), 3500);

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
                    maxOutputTokens: 350,
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

              // Model 2 ALSO returned 503/spike -> BREAK GOOGLE CIRCUIT!
              if (res2.status === 503 || res2.status === 500 || res2.status === 502) {
                lastGoogleError = "Google Global Infrastructure Overload (Circuit Broken)";
                googleCircuitBroken = true;
                break; // Stop looping remaining 4 Google keys, immediately jump to Groq!
              }
            } catch (err2: any) {
              clearTimeout(timeout2);
              lastGoogleError = err2?.message || "Model 2 Timeout";
              googleCircuitBroken = true;
              break;
            }
          }
        } catch (e1: any) {
          clearTimeout(timeout1);
          lastGoogleError = e1?.message || "Model 1 Timeout";
          // If timeout occurred, check if we should break or try next
          if (e1?.name === "AbortError") {
            lastGoogleError = "Google 4.5s Timeout";
          }
        }

        if (googleCircuitBroken) break;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: INSTANT GROQ LPU MULTIMODAL FAILOVER (0.3s)
    // ─────────────────────────────────────────────────────────────
    const groqKey =
      process.env.GROQ_API_KEY_LIVE?.replace(/["'\r\n]/g, "").trim() ||
      getGroqKey();

    if (groqKey) {
      const groqController = new AbortController();
      const groqTimeout = setTimeout(() => groqController.abort(), 4000);

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
            max_tokens: 350,
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
