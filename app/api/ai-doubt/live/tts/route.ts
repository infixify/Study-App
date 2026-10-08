import { NextRequest, NextResponse } from "next/server";

// Cloudflare Pages / Next-on-Pages requires all dynamic routes to export edge runtime
export const runtime = "edge";

const TRUSTED_CLIENT_TOKEN =
  process.env.MICROSOFT_EDGE_TOKEN || "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;
const CHROMIUM_VERSION = process.env.EDGE_CHROMIUM_VERSION || "143.0.3650.75";

/**
 * Computes Microsoft Sec-MS-GEC DRM Token using Web Crypto (100% Edge Runtime Compatible)
 * Uses standard number arithmetic avoiding '...n' BigInt literals for zero build failure.
 */
async function generateSecMsGec(clientToken: string): Promise<string> {
  let ticks = Date.now() / 1000 + WIN_EPOCH;
  ticks -= ticks % 300; // Round down to nearest 5 minutes
  ticks *= S_TO_NS / 100; // Convert to 100ns intervals
  const strToHash = ticks.toFixed(0) + clientToken;

  const enc = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(strToHash)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Normalizes text for continuous, natural faculty speech:
 * - Eliminates artificial long pauses caused by duplicate punctuation or ellipses
 * - Strips mid-sentence awkward commas so voice flows seamlessly
 * - Expands Hinglish / Physics & Maths abbreviations into natural spoken sounds
 */
function normalizeForFastSmoothSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove markdown, latex wrappers, bullet hashes
  text = text.replace(/[*#`_~\[\](){}]/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");

  // 2. Reduce multiple pauses, ellipses, dashes, colons to continuous flow
  text = text.replace(/\.{2,}/g, " ");
  text = text.replace(/,{2,}/g, " ");
  text = text.replace(/[:;-]{2,}/g, " ");
  text = text.replace(/[:;]/g, " ");

  // 3. Spoken Indian Faculty Academic Pronunciation Dictionaries
  text = text.replace(/\bapprox\b/gi, "lagbhag");
  text = text.replace(/\beqn\b|\beq\b/gi, "equation");
  text = text.replace(/\bw\.r\.t\b/gi, "with respect to");
  text = text.replace(/\bi\.e\b/gi, "yaani ki");
  text = text.replace(/\be\.g\b/gi, "for example");
  text = text.replace(/\bfig\b/gi, "figure");
  text = text.replace(/\bconst\b/gi, "constant");
  text = text.replace(/\bmag\b/gi, "magnification");
  text = text.replace(/\bdiff\b/gi, "differentiation");
  text = text.replace(/\bint\b/gi, "integration");

  // Math & Physics notation pronunciation fixes
  text = text.replace(/\bvo\b/gi, "v objective");
  text = text.replace(/\buo\b/gi, "u objective");
  text = text.replace(/\bfo\b/gi, "f objective");
  text = text.replace(/\bfe\b/gi, "f eyepiece");
  text = text.replace(/\bMo\b/gi, "M objective");
  text = text.replace(/\bMe\b/gi, "M eyepiece");

  // Mathematical operators to spoken words
  text = text.replace(/\+/g, " plus ");
  text = text.replace(/\s-\s/g, " minus ");
  text = text.replace(/\s\*\s|\s×\s/g, " into ");
  text = text.replace(/\s\/\s|\s÷\s/g, " divided by ");
  text = text.replace(/\s=\s/g, " equals ");
  text = text.replace(/\s≈\s/g, " approximately equals ");

  // 4. Aggressively strip mid-sentence commas & hinge pauses so speech flows seamlessly
  text = text.replace(/,\s*(hai|ki|toh|aur|se|mein|ka|ke|ko|par|jab|tab|isliye|kyuki|lekin)\b/gi, " $1");
  text = text.replace(/([a-zA-Z0-9]+),\s*([a-zA-Z0-9]+)/g, "$1 $2");
  text = text.replace(/,/g, " ");

  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, 240);
}

/**
 * Microsoft Edge Read-Aloud WebSockets Streaming Synthesizer (Edge Runtime Compatible)
 */
async function synthesizeEdgeTTS(
  cleanText: string,
  timeoutMs = 12000
): Promise<Blob | null> {
  try {
    const secMsGec = await generateSecMsGec(TRUSTED_CLIENT_TOKEN);
    const connectionId = crypto.randomUUID().replace(/-/g, "");
    const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-${CHROMIUM_VERSION}&ConnectionId=${connectionId}`;

    return await new Promise<Blob | null>(async (resolve) => {
      let finished = false;
      const audioChunks: Uint8Array[] = [];

      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          try {
            ws?.close();
          } catch (_) {}
          resolve(null);
        }
      }, timeoutMs);

      let ws: any = null;

      try {
        if (typeof WebSocket !== "undefined") {
          ws = new WebSocket(wssUrl);
        } else {
          const cfResp = await fetch(
            wssUrl.replace(/^wss:/, "https:"),
            {
              headers: {
                Upgrade: "websocket",
                "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_VERSION} Safari/${CHROMIUM_VERSION} Edg/${CHROMIUM_VERSION}`,
                Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
              },
            }
          );
          ws = (cfResp as any).webSocket;
          if (ws?.accept) ws.accept();
        }

        if (!ws) {
          clearTimeout(timer);
          return resolve(null);
        }

        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
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

          const reqId = crypto.randomUUID().replace(/-/g, "");
          const escapedText = cleanText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");

          // Rapid lively faculty cadence: rate +12% with tight punctuation silence boundaries (Sentence: 70ms, Comma: 30ms)
          const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="hi-IN"><voice name="hi-IN-MadhurNeural"><mstts:silence type="Sentenceboundary" value="70ms"/><mstts:silence type="Comma-exact" value="30ms"/><prosody pitch="+0Hz" rate="+12%">${escapedText}</prosody></voice></speak>`;
          const speechMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
          ws.send(speechMsg);
        };

        ws.onmessage = (event: any) => {
          if (typeof event.data === "string") {
            if (event.data.includes("Path:turn.end")) {
              if (!finished) {
                finished = true;
                clearTimeout(timer);
                try {
                  ws.close();
                } catch (_) {}

                if (audioChunks.length === 0) return resolve(null);
                const totalLen = audioChunks.reduce(
                  (acc, chunk) => acc + chunk.length,
                  0
                );
                const merged = new Uint8Array(totalLen);
                let offset = 0;
                for (const chunk of audioChunks) {
                  merged.set(chunk, offset);
                  offset += chunk.length;
                }
                resolve(new Blob([merged], { type: "audio/mpeg" }));
              }
            }
          } else if (event.data instanceof ArrayBuffer) {
            const buffer = new Uint8Array(event.data);
            if (buffer.length > 2) {
              const view = new DataView(event.data);
              const headerLen = view.getUint16(0);
              if (buffer.length > 2 + headerLen) {
                const audioSlice = buffer.slice(2 + headerLen);
                if (audioSlice.length > 0) {
                  audioChunks.push(audioSlice);
                }
              }
            }
          }
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

        ws.onclose = () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            if (audioChunks.length > 0) {
              const totalLen = audioChunks.reduce(
                (acc, chunk) => acc + chunk.length,
                0
              );
              const merged = new Uint8Array(totalLen);
              let offset = 0;
              for (const chunk of audioChunks) {
                merged.set(chunk, offset);
                offset += chunk.length;
              }
              resolve(new Blob([merged], { type: "audio/mpeg" }));
            } else {
              resolve(null);
            }
          }
        };
      } catch (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(null);
        }
      }
    });
  } catch (_) {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    let text: string | null = null;
    let provider = "auto";
    try {
      const body = await req.json();
      if (typeof body?.text === "string") text = body.text.trim();
      if (typeof body?.provider === "string") provider = body.provider;
    } catch (_) {
      const { searchParams } = new URL(req.url);
      text = searchParams.get("text")?.trim() ?? null;
      provider = searchParams.get("provider") || "auto";
    }

    if (!text) {
      return new NextResponse("Missing text parameter", { status: 400 });
    }

    const cleanText = normalizeForFastSmoothSpeech(text);

    // TIER 1: MICROSOFT EDGE NEURAL TTS
    if (provider !== "sarvam") {
      try {
        const edgeBlob = await synthesizeEdgeTTS(cleanText, 12000);
        if (edgeBlob && edgeBlob.size > 200) {
          return new Response(edgeBlob, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
              "X-TTS-Provider": "edge-neural-madhur",
            },
          });
        }
      } catch (_) {}
    }

    // TIER 2: SARVAM AI FALLBACK
    const sarvamApiKey = process.env.SARVAM_API_KEY;
    if (sarvamApiKey) {
      try {
        const res = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": sarvamApiKey,
          },
          body: JSON.stringify({
            inputs: [cleanText],
            target_language_code: "hi-IN",
            speaker: "shubh",
            pitch: 0,
            pace: 1.15,
            loudness: 1.5,
            speech_sample_rate: 22050,
            enable_preprocessing: true,
            model: "bulbul:v1",
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const base64Audio = data.audios?.[0];
          if (base64Audio) {
            const binary = atob(base64Audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return new Response(new Blob([bytes], { type: "audio/wav" }), {
              status: 200,
              headers: {
                "Content-Type": "audio/wav",
                "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
                "X-TTS-Provider": "sarvam-shubh",
              },
            });
          }
        }
      } catch (_) {}
    }

    // TIER 3: GOOGLE TRANSLATE FALLBACK
    try {
      const encoded = encodeURIComponent(cleanText);
      const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=hi&client=tw-ob`;
      const gRes = await fetch(googleUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (gRes.ok) {
        const buf = await gRes.arrayBuffer();
        return new Response(new Blob([buf], { type: "audio/mpeg" }), {
          status: 200,
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

// Backwards-compatible GET endpoint (short texts only)
export async function GET(req: NextRequest) {
  return POST(req);
}
