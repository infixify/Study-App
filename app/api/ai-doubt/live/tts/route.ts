import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text")?.trim();
    const provider = searchParams.get("provider") || "google";

    if (!text) {
      return new NextResponse("Missing text parameter", { status: 400 });
    }

    // Clean text: strip markdown symbols, asterisks, math delimiters
    const cleanText = text
      .replace(/[*#`_~\[\]()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 300);

    // ─────────────────────────────────────────────────────────────
    // TIER 1: GOOGLE NEURAL TTS (0.2s ultra-fast, 99.99% uptime)
    // ─────────────────────────────────────────────────────────────
    if (provider !== "sarvam") {
      try {
        const encoded = encodeURIComponent(cleanText);
        const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=hi&client=tw-ob`;
        
        const googleController = new AbortController();
        const timeout = setTimeout(() => googleController.abort(), 2000);

        const res = await fetch(googleUrl, {
          signal: googleController.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        clearTimeout(timeout);

        if (res.ok) {
          const audioBuffer = await res.arrayBuffer();
          return new NextResponse(audioBuffer, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=3600",
              "X-TTS-Provider": "google-neural",
            },
          });
        }
      } catch (e) {
        console.warn("Google TTS failed or timed out, cascading to Sarvam...");
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: SARVAM AI (BULBUL TTS) FAILOVER
    // ─────────────────────────────────────────────────────────────
    const sarvamApiKey = process.env.SARVAM_API_KEY?.replace(/["'\r\n]/g, "").trim();
    if (sarvamApiKey) {
      try {
        const sarvamController = new AbortController();
        const timeout = setTimeout(() => sarvamController.abort(), 2500);

        const sarvamRes = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          signal: sarvamController.signal,
          headers: {
            "api-subscription-key": sarvamApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            inputs: [cleanText],
            target_language_code: "hi-IN",
            speaker: "arvind", // Male Indian Faculty Voice
            pitch: 0,
            pace: 1.1,
            loudness: 1.5,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: "bulbul:v1",
          }),
        });
        clearTimeout(timeout);

        if (sarvamRes.ok) {
          const data = await sarvamRes.json();
          const base64Audio = data?.audios?.[0];
          if (base64Audio) {
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            return new NextResponse(bytes.buffer, {
              headers: {
                "Content-Type": "audio/wav",
                "X-TTS-Provider": "sarvam-bulbul",
              },
            });
          }
        }
      } catch (e) {
        console.warn("Sarvam AI TTS failed, triggering client fallback.");
      }
    }

    return new NextResponse("TTS server fallback required", { status: 503 });
  } catch (err: any) {
    return new NextResponse("TTS internal error", { status: 500 });
  }
}
