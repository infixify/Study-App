import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TRUSTED_CLIENT_TOKEN =
  process.env.MICROSOFT_EDGE_TOKEN || "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;

// Dynamic Chromium Version fallback support (Environment configurable)
const CHROMIUM_VERSION = process.env.EDGE_CHROMIUM_VERSION || "143.0.3650.75";

/**
 * Computes Microsoft Sec-MS-GEC DRM Token based on 5-minute rounded timestamp
 */
function generateSecMsGec(clientToken: string): string {
  const crypto = require("crypto");
  let ticks = Date.now() / 1000;
  ticks += WIN_EPOCH;
  ticks -= ticks % 300; // Round down to nearest 5 minutes
  ticks *= S_TO_NS / 100; // Convert to 100ns units
  const strToHash = ticks.toFixed(0) + clientToken;
  return crypto.createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

/**
 * Synthesizes speech using Microsoft Edge Neural TTS (hi-IN-MadhurNeural - Male Kota Faculty Voice)
 */
async function synthesizeEdgeTTS(cleanText: string, timeoutMs = 2800): Promise<Buffer | null> {
  const crypto = require("crypto");
  const connectionId = crypto.randomUUID().replace(/-/g, "");
  const secMsGec = generateSecMsGec(TRUSTED_CLIENT_TOKEN);
  const secMsGecVersion = `1-${CHROMIUM_VERSION}`;

  const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${secMsGecVersion}`;

  return new Promise((resolve) => {
    let finished = false;
    const audioChunks: Buffer[] = [];

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          ws.close();
        } catch (_) {}
        resolve(null);
      }
    }, timeoutMs);

    let ws: any;
    try {
      ws = new WebSocket(wssUrl, {
        headers: {
          "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_VERSION} Safari/537.36 Edg/${CHROMIUM_VERSION}`,
          Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      return resolve(null);
    }

    ws.onopen = () => {
      try {
        // 1. Send speech.config
        const configMsg =
          "Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: "false",
                    wordBoundaryEnabled: "false",
                  },
                  outputFormat: "audio-24khz-48kbitrate-mono-mp3",
                },
              },
            },
          });
        ws.send(configMsg);

        // 2. Send SSML request (hi-IN-MadhurNeural: Energetic Indian Male Faculty)
        const reqId = crypto.randomUUID().replace(/-/g, "");
        const escapedText = cleanText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");

        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hi-IN"><voice name="hi-IN-MadhurNeural"><prosody pitch="+0Hz" rate="+5%">${escapedText}</prosody></voice></speak>`;
        const speechMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
        ws.send(speechMsg);
      } catch (_) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          try {
            ws.close();
          } catch (_) {}
          resolve(null);
        }
      }
    };

    ws.onmessage = async (evt: any) => {
      try {
        if (typeof evt.data === "string") {
          if (evt.data.includes("Path:turn.end")) {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              try {
                ws.close();
              } catch (_) {}
              if (audioChunks.length > 0) {
                resolve(Buffer.concat(audioChunks));
              } else {
                resolve(null);
              }
            }
          }
        } else {
          // Binary audio frame: First 2 bytes are header length
          const arrayBuf = await evt.data.arrayBuffer();
          const buf = Buffer.from(arrayBuf);
          if (buf.length > 2) {
            const headerLen = buf.readUInt16BE(0);
            const audioData = buf.subarray(2 + headerLen);
            if (audioData.length > 0) {
              audioChunks.push(audioData);
            }
          }
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        try {
          ws.close();
        } catch (_) {}
        resolve(null);
      }
    };
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text")?.trim();
    const provider = searchParams.get("provider") || "auto";

    if (!text) {
      return new NextResponse("Missing text parameter", { status: 400 });
    }

    // Clean text: strip markdown symbols, asterisks, math delimiters
    const cleanText = text
      .replace(/[*#`_~\[\]()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    // ─────────────────────────────────────────────────────────────
    // TIER 1: MICROSOFT EDGE NEURAL TTS (hi-IN-MadhurNeural Male)
    // 100% Free, Zero API Key, Natural Indian Male Faculty
    // ─────────────────────────────────────────────────────────────
    if (provider !== "sarvam") {
      try {
        const edgeAudio = await synthesizeEdgeTTS(cleanText, 2500);
        if (edgeAudio && edgeAudio.length > 0) {
          return new NextResponse(edgeAudio, {
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
              "X-TTS-Provider": "microsoft-edge-madhurneural",
            },
          });
        }
      } catch (e) {
        console.warn("Microsoft Edge TTS failed, cascading to Sarvam AI...");
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 2: SARVAM AI (BULBUL:V3 TTS) FAILOVER
    // Model: "bulbul:v3", Speaker: "shubh" (Active Male Faculty)
    // Only used if Microsoft Edge TTS encounters network timeout/policy change
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
            speaker: "shubh", // Active Male Faculty Voice on bulbul:v3
            pitch: 0,
            pace: 1.05,
            loudness: 1.5,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: "bulbul:v3",
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
                "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
                "X-TTS-Provider": "sarvam-bulbul-v3",
              },
            });
          }
        }
      } catch (e) {
        console.warn("Sarvam AI TTS failed, triggering client fallback.");
      }
    }

    // ─────────────────────────────────────────────────────────────
    // TIER 3: GOOGLE TRANSLATE FAST FALLBACK (If configured/needed)
    // ─────────────────────────────────────────────────────────────
    try {
      const encoded = encodeURIComponent(cleanText);
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=hi&client=tw-ob`;
      const googleRes = await fetch(googleUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (googleRes.ok) {
        const audioBuffer = await googleRes.arrayBuffer();
        return new NextResponse(audioBuffer, {
          headers: {
            "Content-Type": "audio/mpeg",
            "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
            "X-TTS-Provider": "google-fallback",
          },
        });
      }
    } catch (_) {}

    return new NextResponse("TTS server fallback required", { status: 503 });
  } catch (err: any) {
    return new NextResponse("TTS internal error", { status: 500 });
  }
}
