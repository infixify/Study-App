import { NextRequest, NextResponse } from "next/server";
import { getLiveGeminiKeys, getImageGeminiKeys } from "@/lib/ai-key-manager";

export const runtime = "edge";

const LIVE_FACULTY_PROMPT = `Tu PrepWise ka real-time Live Video AI Faculty hai for JEE, NEET aur Board exams.
Student ne video call par camera se apna textbook, notes ya question dikhaya hai aur aawaz se doubt pucha hai.

RULES FOR LIVE VIDEO CALL ANSWERS:
1. Short & Direct: Jawab sirf 2 se 4 lines mein clear, to-the-point teacher tone mein de.
2. Spoken Hinglish: Natural conversational Hinglish mein baat kar taaki bolne par natural lage. Raw markdown formatting ya complex LaTeX delimiters ($ ya \\frac) mat use kar.
3. Formulas & Values: Formula clear Unicode mein bol (jaise v = u + at, F = q(v × B), PV = nRT).
4. Step-by-Step Clarity: Seedha problem solve kar bina faltu intro ke.`;

export async function POST(req: NextRequest) {
  try {
    const { frame, message, studentContext } = await req.json();

    if (!frame && !message) {
      return NextResponse.json({ reply: "Kripya camera se question dikhayein ya bol kar puchein." }, { status: 400 });
    }

    // Connect strictly to the 5-key Live Cam pool (GEMINI_API_KEYS)
    let keys = getLiveGeminiKeys();
    if (keys.length === 0) {
      // Graceful fallback to image keys if live keys not configured
      keys = getImageGeminiKeys();
    }

    if (keys.length === 0) {
      return NextResponse.json(
        { reply: "Live AI Faculty key configure nahi hai. Kripya environment settings check karein." },
        { status: 500 }
      );
    }

    let promptText = message || "Is sawal ko solve karke step-by-step samjhaiye.";
    if (studentContext?.targetExam) {
      promptText = `[Student Target: ${studentContext.targetExam}] ${promptText}`;
    }

    const models = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
    let lastError = "";

    // Rotate through the 5 keys in the live pool
    for (const key of keys) {
      for (const model of models) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        try {
          const parts: any[] = [{ text: promptText }];
          if (frame && typeof frame === "string") {
            const rawBase64 = frame.includes(",") ? frame.split(",")[1] : frame;
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
                temperature: 0.4,
                maxOutputTokens: 500,
              },
            }),
          });

          clearTimeout(timeout);

          if (res.status === 503 || res.status === 429) {
            lastError = `Live Key Overloaded (${res.status})`;
            break; // Try next key
          }

          if (!res.ok) {
            const err = await res.text();
            lastError = `${model} ${res.status}: ${err.slice(0, 100)}`;
            continue;
          }

          const data = await res.json();
          const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (reply) {
            return NextResponse.json({
              reply,
              model: `Gemini Live (${model})`,
              success: true,
            });
          }
        } catch (e: any) {
          clearTimeout(timeout);
          lastError = e?.message || String(e);
        }
      }
    }

    return NextResponse.json(
      {
        reply: `Network issue aaya: ${lastError || "Kripya dobara sawal puchein."}`,
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
