import { NextRequest, NextResponse } from "next/server";
import tls from "tls";
import crypto from "crypto";

export const runtime = "nodejs";

const TRUSTED_CLIENT_TOKEN =
  process.env.MICROSOFT_EDGE_TOKEN || "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const WIN_EPOCH = 11644473600;
const S_TO_NS = 1e9;
const CHROMIUM_VERSION = process.env.EDGE_CHROMIUM_VERSION || "143.0.3650.75";

/**
 * Computes Microsoft Sec-MS-GEC DRM Token based on 5-minute rounded timestamp
 */
function generateSecMsGec(clientToken: string): string {
  let ticks = Date.now() / 1000 + WIN_EPOCH;
  ticks -= ticks % 300; // Round down to nearest 5 minutes
  ticks *= S_TO_NS / 100; // Convert to 100ns intervals
  const strToHash = ticks.toFixed(0) + clientToken;
  return crypto.createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
}

/**
 * Robust TLS-based WebSocket synthesis for Microsoft Edge Neural TTS
 * Avoids browser DOM TypeScript type-checking errors during Next.js build.
 */
function synthesizeEdgeTTS(cleanText: string, timeoutMs = 2800): Promise<Buffer | null> {
  return new Promise((resolve) => {
    let finished = false;
    const audioChunks: Buffer[] = [];
    let buffer = Buffer.alloc(0);
    let upgraded = false;

    const connectionId = crypto.randomUUID().replace(/-/g, "");
    const secMsGec = generateSecMsGec(TRUSTED_CLIENT_TOKEN);
    const path = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-${CHROMIUM_VERSION}`;

    const socket = tls.connect(
      {
        host: "speech.platform.bing.com",
        port: 443,
        servername: "speech.platform.bing.com",
      },
      () => {
        const handshake =
          `GET ${path} HTTP/1.1\r\n` +
          `Host: speech.platform.bing.com\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_VERSION} Safari/${CHROMIUM_VERSION} Edg/${CHROMIUM_VERSION}\r\n` +
          `Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold\r\n\r\n`;
        socket.write(handshake);
      }
    );

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          socket.destroy();
        } catch (_) {}
        resolve(null);
      }
    }, timeoutMs);

    function sendFrame(payload: Buffer, isBinary = false) {
      const length = payload.length;
      const opcode = isBinary ? 0x82 : 0x81;
      const mask = crypto.randomBytes(4);
      let header: Buffer;
      if (length <= 125) {
        header = Buffer.from([opcode, 0x80 | length]);
      } else if (length <= 65535) {
        header = Buffer.alloc(4);
        header[0] = opcode;
        header[1] = 0x80 | 126;
        header.writeUInt16BE(length, 2);
      } else {
        header = Buffer.alloc(10);
        header[0] = opcode;
        header[1] = 0x80 | 127;
        header.writeBigUInt64BE(BigInt(length), 2);
      }
      const masked = Buffer.alloc(length);
      for (let i = 0; i < length; i++) {
        masked[i] = payload[i] ^ mask[i % 4];
      }
      socket.write(Buffer.concat([header, mask, masked]));
    }

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const headerEnd = buffer.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const resp = buffer.subarray(0, headerEnd).toString("utf-8");
          if (resp.includes("101 Switching Protocols")) {
            upgraded = true;
            buffer = buffer.subarray(headerEnd + 4);

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
            sendFrame(Buffer.from(configMsg, "utf-8"));

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
            sendFrame(Buffer.from(speechMsg, "utf-8"));
          } else {
            finished = true;
            clearTimeout(timer);
            socket.destroy();
            return resolve(null);
          }
        }
      }

      // Process WebSocket frames
      while (upgraded && buffer.length >= 2) {
        const opcode = buffer[0] & 0x0f;
        let payloadLen = buffer[1] & 0x7f;
        let offset = 2;
        if (payloadLen === 126) {
          if (buffer.length < 4) break;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) break;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }

        if (buffer.length < offset + payloadLen) break;
        const payload = buffer.subarray(offset, offset + payloadLen);
        buffer = buffer.subarray(offset + payloadLen);

        if (opcode === 2) {
          // Binary audio frame
          if (payload.length > 2) {
            const hLen = payload.readUInt16BE(0);
            const audioData = payload.subarray(2 + hLen);
            if (audioData.length > 0) audioChunks.push(audioData);
          }
        } else if (opcode === 1) {
          const text = payload.toString("utf-8");
          if (text.includes("Path:turn.end")) {
            if (!finished) {
              finished = true;
              clearTimeout(timer);
              socket.destroy();
              resolve(Buffer.concat(audioChunks));
            }
            return;
          }
        }
      }
    });

    socket.on("error", () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        try {
          socket.destroy();
        } catch (_) {}
        resolve(null);
      }
    });
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
