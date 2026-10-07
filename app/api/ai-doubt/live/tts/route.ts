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
 * - Expands Hinglish / Physics & Maths abbreviations into natural spoken sounds
 */
function normalizeForFastSmoothSpeech(raw: string): string {
  if (!raw) return "";
  let text = raw;

  // 1. Remove markdown, latex wrappers, bullet hashes
  text = text.replace(/[*#`_~\[\](){}]/g, " ");
  text = text.replace(/Step \d+:\s*/gi, "");

  // 2. Reduce multiple commas, dots, dashes, colons to a single light pause
  text = text.replace(/\.{2,}/g, ".");
  text = text.replace(/,{2,}/g, ",");
  text = text.replace(/[:;-]{2,}/g, " ");
  text = text.replace(/[:;]/g, ",");

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

  // 4. Smooth out awkward commas between small words (avoids robotic stutter)
  text = text.replace(/,\s*(hai|ki|toh|aur|se|mein|ka|ke|ko)\b/gi, " $1");
  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, 220);
}

/**
 * Edge Runtime synthesis for Microsoft Edge Neural TTS (hi-IN-MadhurNeural)
 * Works in Cloudflare Workers / Pages & Edge runtimes via native WebSocket / fetch Upgrade.
 */
async function synthesizeEdgeTTS(
  cleanText: string,
  timeoutMs = 2800
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

          // Prosody tuning: rate +10% ensures energetic faculty flow without robotic trailing pauses
          const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hi-IN"><voice name="hi-IN-MadhurNeural"><prosody pitch="+0Hz" rate="+10%">${escapedText}</prosody></voice></speak>`;
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text")?.trim();
    const provider = searchParams.get("provider") || "auto";

    if (!text) {
      return new NextResponse("Missing text parameter", { status: 400 });
    }

    // Normalizing text for smooth spoken tempo without stutter pauses
    const cleanText = normalizeForFastSmoothSpeech(text);

    // ─────────────────────────────────────────────────────────────
    // TIER 1: MICROSOFT EDGE NEURAL TTS (hi-IN-MadhurNeural Male)
    // ─────────────────────────────────────────────────────────────
    if (provider !== "sarvam") {
      try {
        const edgeBlob = await synthesizeEdgeTTS(cleanText, 2500);
        if (edgeBlob && edgeBlob.size > 0) {
          return new Response(edgeBlob, {
            status: 200,
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
            speaker: "shubh",
            pitch: 0,
            pace: 1.1,
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

            const sarvamBlob = new Blob([bytes], { type: "audio/wav" });
            return new Response(sarvamBlob, {
              status: 200,
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
    // TIER 3: GOOGLE TRANSLATE FALLBACK
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
        const googleBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
        return new Response(googleBlob, {
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
