import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Your Sarvam API key from Cloudflare
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;

// ========== HINDI-ENGLISH TO DEVANAGARI CONVERTER (For Bhashini) ==========
/** Converts Hinglish to pure Devanagari Hindi for correct pronunciation */
function convertHinglishToDevanagari(text: string): string {
  // Common English words in Indian education that should stay in English
  const ENGLISH_WORDS = [
    'F', 'ma', 'm', 'a', 'v', 'u', 't', 's', 'c', 'p', 'e', 'r',
    'force', 'mass', 'acceleration', 'velocity', 'energy', 'power',
    'Newton', 'Einstein', 'Physics', 'Maths', 'Chemistry', 'Biology',
    'law', 'theorem', 'formula', 'equation', 'graph', 'diagram',
    'cm', 'mm', 'kg', 'm/s', 'm/s2', 'J', 'N', 'W', 'V', 'A',
    'sin', 'cos', 'tan', 'log', 'ln'
  ];

  // Replace common Hinglish patterns with Devanagari
  const hinglishMap: Record<string, string> = {
    // Numbers
    '0': '०', '1': '१', '2': '२', '3': '३', '4': '४', '5': '५',
    '6': '६', '7': '७', '8': '८', '9': '९',

    // Common words
    'hai': 'है', 'mein': 'में', 'ka': 'का', 'ke': 'के', 'ki': 'की',
    'aur': 'और', 'to': 'तो', 'par': 'पर', 'se': 'से', 'bhi': 'भी',
    'nahi': 'नहीं', 'kyunki': 'क्योकी', 'lekin': 'लेकिन', 'isliye': 'इसलिए',
    'jab': 'जब', 'tab': 'तब', 'agar': 'अगर', 'toh': 'तो',
    'yani': 'यानी', 'ye': 'ये', 'wo': 'वो', 'in': 'इन',

    // Math symbols in words
    'plus': ' जमा ', 'minus': ' घटा ', 'into': ' गुणा ', 'divided by': ' भाग ',
    'equals': ' बराबर ', 'approximately': ' लगभग '
  };

  let result = text;

  // First: Keep English words as-is (for scientific terms)
  const englishRegex = new RegExp(`\\b(${ENGLISH_WORDS.join('|')})\\b`, 'gi');
  const englishMatches: {index: number, word: string}[] = [];
  let match;
  while ((match = englishRegex.exec(text)) !== null) {
    englishMatches.push({ index: match.index, word: match[0] });
  }

  // Second: Convert Hinglish to Devanagari
  for (const [hinglish, devanagari] of Object.entries(hinglishMap)) {
    result = result.replace(new RegExp(hinglish, 'gi'), devanagari);
  }

  // Third: Restore English words that were accidentally converted
  for (const { index, word } of englishMatches) {
    const before = result.substring(0, index);
    const after = result.substring(index + word.length);
    result = before + word + after;
  }

  // Clean up extra spaces
  return result.replace(/\s+/g, ' ').trim();
}

// ========== TIER 1: MICROSOFT EDGE TTS (hi-IN-MadhurNeural - MALE VOICE) ==========
async function synthesizeEdgeTTS(text: string): Promise<Blob | null> {
  try {
    const WIN_EPOCH = 11644473600;
    const seconds = Math.floor(Date.now() / 1000) + WIN_EPOCH;
    const roundedSeconds = seconds - (seconds % 300);
    const ticks = BigInt(roundedSeconds) * BigInt("10000000");
    const strToHash = ticks.toString() + "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", enc.encode(strToHash));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const secMsGec = hashArray.map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();

    const connectionId = crypto.randomUUID().replace(/-/g, "");
    const CHROMIUM_VERSION = "143.0.3650.75";
    const wssUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-${CHROMIUM_VERSION}&ConnectionId=${connectionId}`;

    return new Promise<Blob | null>((resolve) => {
      let finished = false;
      const audioChunks: Uint8Array[] = [];
      const timer = setTimeout(() => {
        if (!finished) { finished = true; resolve(null); }
      }, 12000);

      const ws = new WebSocket(wssUrl);

      ws.onopen = () => {
        const configMsg = "Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: "false", wordBoundaryEnabled: "false" },
                  outputFormat: "audio-24khz-48kbitrate-mono-mp3"
                }
              }
            }
          });
        ws.send(configMsg);

        const escapedText = text
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;").replace(/'/g, "&apos;");

        const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="hi-IN">
          <voice name="hi-IN-MadhurNeural"><prosody rate="+10%">${escapedText}</prosody></voice>
        </speak>`;

        const speechMsg = `X-RequestId:${crypto.randomUUID().replace(/-/g, "")}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
        ws.send(speechMsg);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === "string") {
          if (event.data.includes("Path:turn.end")) {
            if (!finished) {
              finished = true; clearTimeout(timer); ws.close();
              if (audioChunks.length > 0) {
                const merged = new Uint8Array(audioChunks.reduce((a, b) => a + b.length, 0));
                let offset = 0;
                for (const chunk of audioChunks) { merged.set(chunk, offset); offset += chunk.length; }
                resolve(new Blob([merged], { type: "audio/mpeg" }));
              } else { resolve(null); }
            }
          }
        } else if (event.data instanceof ArrayBuffer) {
          const buffer = new Uint8Array(event.data);
          if (buffer.length > 2) {
            const view = new DataView(event.data);
            const headerLen = view.getUint16(0);
            if (buffer.length > 2 + headerLen) {
              const audioSlice = buffer.slice(2 + headerLen);
              if (audioSlice.length > 0) audioChunks.push(audioSlice);
            }
          }
        }
      };

      ws.onerror = () => { if (!finished) { finished = true; clearTimeout(timer); resolve(null); } };
      ws.onclose = () => { if (!finished) { finished = true; clearTimeout(timer); resolve(null); } };
    });
  } catch (_) { return null; }
}

// ========== TIER 2: SARVAM AI (Shubh model v3 - as requested) ==========
async function synthesizeSarvamTTS(text: string): Promise<Blob | null> {
  if (!SARVAM_API_KEY) return null;

  try {
    const res = await fetch("https://api.sarvam.ai/v1/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        language_code: "hi-IN",
        speaker: "shubh",
        pace: 1.15,
        speech_sample_rate: 24000,
        model: "bulbul:v3",
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.audios?.[0]) {
        const audio = Buffer.from(data.audios[0], "base64");
        return new Blob([audio], { type: "audio/wav" });
      }
    }
  } catch (_) {}
  return null;
}

// ========== TIER 3: BHASHINI (With male voice + Hinglish to Devanagari Conversion) ==========
async function synthesizeBhashiniTTS(text: string): Promise<Blob | null> {
  try {
    // Convert Hinglish to pure Devanagari for correct pronunciation
    const devanagariText = convertHinglishToDevanagari(text);

    const res = await fetch("https://api.bhashini.gov.in/services/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: [{ source: devanagariText }],
        config: {
          language: { sourceLanguage: "hi" },
          domain: "general",
          speaker: { gender: "male" }
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (res.ok) {
      const data = await res.json();
      const audioUrl = data?.output?.[0]?.audio?.[0];
      if (audioUrl) {
        const audioRes = await fetch(audioUrl);
        if (audioRes.ok) {
          const audio = await audioRes.arrayBuffer();
          return new Blob([audio], { type: "audio/wav" });
        }
      }
    }
  } catch (_) {}
  return null;
}

// ========== TIER 4: DEVICE NATIVE ==========
function getNativeTTSResponse(text: string): string {
  return JSON.stringify({
    type: "native",
    text: text,
    voice: "hi-IN-MadhurNeural"
  });
}

export async function POST(req: NextRequest) {
  try {
    let text: string | null = null;
    try {
      const body = await req.json();
      text = body.text?.trim() || null;
    } catch (_) {
      const { searchParams } = new URL(req.url);
      text = searchParams.get("text")?.trim() ?? null;
    }

    if (!text) return new NextResponse("Missing text", { status: 400 });

    // ===== TIER 1: MICROSOFT EDGE (hi-IN-MadhurNeural - MALE VOICE) =====
    console.log("Trying Tier 1: Microsoft Edge TTS (hi-IN-MadhurNeural)");
    let blob = await synthesizeEdgeTTS(text);
    if (blob) {
      console.log("✅ Tier 1 SUCCESS: Microsoft Edge TTS");
      return new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-TTS-Provider": "edge-hi-IN-MadhurNeural",
          "X-TTS-Tier": "1",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    // ===== TIER 2: SARVAM (Shubh model v3 - as requested) =====
    console.log("Trying Tier 2: Sarvam AI (Shubh v3)");
    blob = await synthesizeSarvamTTS(text);
    if (blob) {
      console.log("✅ Tier 2 SUCCESS: Sarvam AI");
      return new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "X-TTS-Provider": "sarvam-shubh-v3",
          "X-TTS-Tier": "2",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    // ===== TIER 3: BHASHINI (With Hinglish to Devanagari + male voice) =====
    console.log("Trying Tier 3: Bhashini (male voice + Hinglish→Devanagari)");
    blob = await synthesizeBhashiniTTS(text);
    if (blob) {
      console.log("✅ Tier 3 SUCCESS: Bhashini TTS");
      return new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "X-TTS-Provider": "bhashini-male",
          "X-TTS-Tier": "3",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    // ===== TIER 4: DEVICE NATIVE =====
    console.log("Falling back to Tier 4: Device Native");
    const nativeResponse = getNativeTTSResponse(text);
    return new NextResponse(nativeResponse, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-TTS-Provider": "native",
        "X-TTS-Tier": "4"
      }
    });

  } catch (err: any) {
    return new NextResponse("TTS error", { status: 500 });
  }
}

// Backwards-compatible GET endpoint
export async function GET(req: NextRequest) {
  return POST(req);
}
