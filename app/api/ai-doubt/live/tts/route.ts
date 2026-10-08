import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Your Sarvam API key from Cloudflare
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;

// ========== HINDI-ENGLISH TO DEVANAGARI CONVERTER ==========
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

  // Replace common Hinglish patterns with Devanagari (NO DUPLICATES, sorted by length)
  const hinglishMap: Record<string, string> = {
    // Numbers
    '0': '\u0966', '1': '\u0967', '2': '\u0968', '3': '\u0969', '4': '\u096a', '5': '\u096b',
    '6': '\u096c', '7': '\u096d', '8': '\u096e', '9': '\u096f',

    // Longer words first (to avoid partial matches)
    'kyunki': '\u0915\u094d\u092f\u094b\u0915\u0940',
    'isliye': '\u0907\u0938\u0932\u093f\u090f',
    'lekin': '\u0932\u0947\u0915\u093f\u0928',
    'nahi': '\u0928\u0939\u0940\u0902',
    'aur': '\u0914\u0930',
    'hai': '\u0939\u0948',
    'mein': '\u092e\u0947\u0902',
    'bhi': '\u092d\u0940',
    'jab': '\u091c\u092c',
    'tab': '\u0924\u092c',
    'agar': '\u0905\u0917\u0930',
    'toh': '\u0924\u094b',
    'yani': '\u092f\u093e\u0928\u0940',
    'ye': '\u092f\u0947',
    'wa': '\u0935\u093e',
    'wo': '\u0935\u094b',
    'in': '\u0907\u0928',
    'ka': '\u0915\u093e',
    'ke': '\u0915\u0947',
    'ki': '\u0915\u0940',
    'to': '\u0924\u094b',
    'par': '\u092a\u0930',
    'se': '\u0938\u0947',

    // Math symbols in words
    'plus': ' \u091c\u092e\u093e ',
    'minus': ' \u0918\u091f\u093e ',
    'into': ' \u0917\u0941\u0923\u093e ',
    'divided by': ' \u092d\u093e\u0917 ',
    'equals': ' \u092c\u0930\u093e\u092c\u0930 ',
    'approximately': ' \u0932\u0917\u092d\u0917 '
  };

  let result = text;

  // First: Keep English words as-is (for scientific terms)
  const englishRegex = new RegExp(`\\b(${ENGLISH_WORDS.join('|')})\\b`, 'gi');
  const englishMatches: {index: number, word: string}[] = [];
  let match;
  const textLower = text.toLowerCase();
  while ((match = englishRegex.exec(textLower)) !== null) {
    englishMatches.push({ index: match.index, word: text.substring(match.index, match.index + match[0].length) });
  }

  // Second: Convert Hinglish to Devanagari (longest keys first, whole words only)
  const sortedKeys = Object.keys(hinglishMap).sort((a, b) => b.length - a.length);
  for (const hinglish of sortedKeys) {
    const devanagari = hinglishMap[hinglish];
    const pattern = new RegExp(`\\b${hinglish}\\b`, 'gi');
    result = result.replace(pattern, devanagari);
  }

  // Third: Restore English words that were accidentally converted
  for (const { index, word } of englishMatches) {
    const before = result.substring(0, index);
    const after = result.substring(index + word.length);
    result = before + word + after;
  }

  // Clean up extra spaces and preserve punctuation properly
  return result.replace(/\s+/g, ' ').trim();
}

// ========== TIER 1: TRAVIS EDGE TTS (hi-IN-MadhurNeural - FAST SPEED) ==========
async function synthesizeTravisTTS(text: string): Promise<Blob | null> {
  try {
    console.log("TIER 1 TRAVIS: Synthesizing text:", text.substring(0, 100));
    
    const res = await fetch("https://tts.travisvn.com/v1/audio/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        voice: "hi-IN-MadhurNeural",
        speed: 1.25  // Faster speed as requested
      }),
      signal: AbortSignal.timeout(15000)
    });

    console.log("TIER 1 TRAVIS: Response status:", res.status);
    
    if (res.ok) {
      const audio = await res.arrayBuffer();
      console.log("TIER 1 TRAVIS: Audio generated, size:", audio.byteLength, "bytes");
      return new Blob([audio], { type: "audio/mpeg" });
    } else {
      const errorText = await res.text();
      console.log("TIER 1 TRAVIS: FAILED - Status:", res.status, "Error:", errorText.substring(0, 200));
    }
  } catch (e: any) {
    console.log("TIER 1 TRAVIS: Exception:", e?.message || String(e));
  }
  return null;
}

// ========== TIER 2: SARVAM AI (Shubh model v3 - FAST SPEED) ==========
async function synthesizeSarvamTTS(text: string): Promise<Blob | null> {
  if (!SARVAM_API_KEY) {
    console.log("TIER 2 SARVAM: API KEY MISSING - Check Cloudflare environment variables");
    return null;
  }

  try {
    console.log("TIER 2 SARVAM: Synthesizing text:", text.substring(0, 100));
    
    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": SARVAM_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        language_code: "hi-IN",
        speaker: "shubh",
        pace: 1.25,  // Faster speed as requested
        speech_sample_rate: 24000,
        model: "bulbul:v3",
      }),
      signal: AbortSignal.timeout(15000)
    });

    console.log("TIER 2 SARVAM: Response status:", res.status);
    
    if (res.ok) {
      const data = await res.json();
      console.log("TIER 2 SARVAM: Response received");
      
      // Sarvam returns base64 audio
      if (data.audios?.[0]) {
        const audio = Buffer.from(data.audios[0], "base64");
        console.log("TIER 2 SARVAM: Audio generated, size:", audio.length, "bytes");
        return new Blob([audio], { type: "audio/wav" });
      } else if (data.audio) {
        // Alternative response format
        const audio = Buffer.from(data.audio, "base64");
        console.log("TIER 2 SARVAM: Audio generated (alt format), size:", audio.length, "bytes");
        return new Blob([audio], { type: "audio/wav" });
      } else {
        console.log("TIER 2 SARVAM: No audio in response, keys:", Object.keys(data));
      }
    } else {
      const errorText = await res.text();
      console.log("TIER 2 SARVAM: FAILED - Status:", res.status, "Error:", errorText.substring(0, 200));
    }
  } catch (e: any) {
    console.log("TIER 2 SARVAM: Exception:", e?.message || String(e));
  }
  return null;
}

// ========== TIER 3: DEVICE NATIVE ==========
function getNativeTTSResponse(text: string): string {
  return JSON.stringify({
    type: "native",
    text: text,
    voice: "hi-IN-MadhurNeural",
    rate: 1.25  // Faster speed for native too
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

    if (!text) {
      console.log("TTS: No text provided");
      return new NextResponse("Missing text", { status: 400 });
    }

    // Clean up excessive punctuation gaps
    // Replace multiple spaces with single space
    // Ensure punctuation doesn't create weird gaps
    text = text
      .replace(/\s+/g, ' ')
      .replace(/([.,!?])\s+/g, '$1 ')  // Single space after punctuation
      .replace(/\s+([.,!?])/g, '$1')    // No space before punctuation
      .trim();

    console.log("\n=== TTS REQUEST START ===");
    console.log("Input text:", text.substring(0, 200));
    console.log("SARVAM_API_KEY present:", !!SARVAM_API_KEY);
    console.log("========================\n");

    // ===== TIER 1: TRAVIS EDGE TTS (hi-IN-MadhurNeural - FAST) =====
    console.log("--- Trying TIER 1: Travis Edge TTS (hi-IN-MadhurNeural, speed=1.25) ---");
    let blob = await synthesizeTravisTTS(text);
    if (blob) {
      console.log("SUCCESS: Tier 1 Travis Edge TTS\n");
      return new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-TTS-Provider": "travis-edge-hi-IN-MadhurNeural",
          "X-TTS-Tier": "1",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    // ===== TIER 2: SARVAM (Shubh v3 - FAST) =====
    console.log("\n--- Trying TIER 2: Sarvam AI (Shubh v3, pace=1.25) ---");
    blob = await synthesizeSarvamTTS(text);
    if (blob) {
      console.log("SUCCESS: Tier 2 Sarvam AI\n");
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

    // ===== TIER 3: DEVICE NATIVE (FAST) =====
    console.log("\n--- Falling back to TIER 3: Device Native (rate=1.25) ---");
    console.log("All previous tiers failed. Returning native TTS JSON.\n");
    const nativeResponse = getNativeTTSResponse(text);
    return new NextResponse(nativeResponse, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-TTS-Provider": "native",
        "X-TTS-Tier": "3"
      }
    });

  } catch (err: any) {
    console.log("TTS HANDLER ERROR:", err?.message || String(err));
    return new NextResponse("TTS error: " + (err?.message || String(err)), { status: 500 });
  }
}

// Backwards-compatible GET endpoint
export async function GET(req: NextRequest) {
  return POST(req);
}
