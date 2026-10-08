import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Your API keys from Cloudflare
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;
const HF_TOKEN = process.env.HF_TOKEN;

// ========== GLOBAL IN-MEMORY CACHE (24-hour expiry, shared across requests) ==========
// Cache structure: Map<textHash, { blob: Blob, timestamp: number, text: string }>
// Using module-level const so it persists across requests in the same worker instance
const ttsCache = new Map<string, { blob: Blob; timestamp: number; text: string }>();

// Clean cache periodically to prevent memory bloat
function cleanupCache() {
  const now = Date.now();
  const keysToDelete: string[] = [];
  
  for (const [key, value] of ttsCache.entries()) {
    if (now - value.timestamp > 86400000) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    ttsCache.delete(key);
  }
  
  // Clean up every 100 requests to prevent memory growth
  if (ttsCache.size > 100) {
    // Keep only the 50 most recent entries
    const entries = Array.from(ttsCache.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .slice(0, 50);
    
    ttsCache.clear();
    for (const [key, value] of entries) {
      ttsCache.set(key, value);
    }
  }
}

async function generateCacheKey(text: string): Promise<string> {
  // Create SHA-256 hash of text for consistent cache keys
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ========== HINDI-ENGLISH TO DEVANAGARI CONVERTER ==========
/** 
 * Converts Hinglish to pure Devanagari Hindi for correct pronunciation.
 * For English scientific terms, converts them to their Hindi pronunciation style.
 * Example: "F ma kya hai?" -> "\u090f\u092b \u092e\u093e \u0915\u094d\u092f\u093e \u0939\u0948?"
 */
function convertHinglishToDevanagari(text: string): string {
  // English scientific terms mapped to their Hindi pronunciation
  // Note: Single letters are handled carefully to avoid conflicts with units
  const ENGLISH_TO_HINDI: Record<string, string> = {
    // Scientific terms (longest first to avoid partial matches)
    'Newton': '\u0928\u094d\u092f\u0942\u091f\u0928',
    'Einstein': '\u0906\u0907\u0902\u0938\u094d\u091f\u0940\u0928',
    'Physics': '\u092b\u093f\u091c\u093f\u0915\u094d\u0938',
    'Maths': '\u092e\u0948\u0925\u094d\u0938',
    'Chemistry': '\u0915\u0947\u092e\u093f\u0938\u094d\u091f\u094d\u0930\u0940',
    'Biology': '\u092c\u093e\u092f\u094b\u0932\u0949\u091c\u0940',
    'force': '\u092b\u094b\u0930\u094d\u0938', 'Force': '\u092b\u094b\u0930\u094d\u0938',
    'mass': '\u092e\u093e\u0938', 'Mass': '\u092e\u093e\u0938',
    'acceleration': '\u090f\u0915\u094d\u0938\u0947\u0932\u0930\u0947\u0936\u0928', 'Acceleration': '\u090f\u0915\u094d\u0938\u0947\u0932\u0930\u0947\u0936\u0928',
    'velocity': '\u0935\u0947\u0932\u0949\u0938\u093f\u091f\u0940', 'Velocity': '\u0935\u0947\u0932\u0949\u0938\u093f\u091f\u0940',
    'energy': '\u090f\u0928\u0930\u094d\u091c\u0940', 'Energy': '\u090f\u0928\u0930\u094d\u091c\u0940',
    'power': '\u092a\u093e\u0935\u0930', 'Power': '\u092a\u093e\u0935\u0930',
    'law': '\u0932\u0949', 'Law': '\u0932\u0949',
    'theorem': '\u0925\u0940\u092f\u094b\u0930\u092e', 'Theorem': '\u0925\u0940\u092f\u094b\u0930\u092e',
    'formula': '\u092b\u0949\u0930\u094d\u092e\u0942\u0932\u093e', 'Formula': '\u092b\u0949\u0930\u094d\u092e\u0942\u0932\u093e',
    'equation': '\u0907\u0915\u094d\u0935\u0947\u0936\u0928', 'Equation': '\u0907\u0915\u094d\u0935\u0947\u0936\u0928',
    'graph': '\u0917\u094d\u0930\u093e\u092b', 'Graph': '\u0917\u094d\u0930\u093e\u092b',
    'diagram': '\u0921\u093e\u092f\u0917\u094d\u0930\u093e\u092e', 'Diagram': '\u0921\u093e\u092f\u0917\u094d\u0930\u093e\u092e',
    
    // Units (as words to avoid single-letter conflicts)
    'cm': '\u0938\u0947\u0902\u091f\u0940\u092e\u0940\u091f\u0930', 'CM': '\u0938\u0947\u0902\u091f\u0940\u092e\u0940\u091f\u0930',
    'mm': '\u092e\u093f\u0932\u0940\u092e\u0940\u091f\u0930', 'MM': '\u092e\u093f\u0932\u0940\u092e\u0940\u091f\u0930',
    'kg': '\u0915\u093f\u0932\u094b\u0917\u094d\u0930\u093e\u092e', 'KG': '\u0915\u093f\u0932\u094b\u0917\u094d\u0930\u093e\u092e',
    'm/s': '\u092e\u0940\u091f\u0930 \u092a\u094d\u0930\u0924\u093f \u0938\u0947\u0915\u0902\u0921',
    'joule': '\u091c\u0942\u0932',
    'newton_unit': '\u0928\u094d\u092f\u0942\u091f\u0928',
    'watt': '\u0935\u093e\u091f',
    'volt': '\u0935\u094b\u0932\u094d\u091f',
    'ampere': '\u090f\u092e\u094d\u092a\u093f\u092f\u0930',
    
    // Math functions
    'sin': '\u0938\u093e\u0907\u0928', 'Sin': '\u0938\u093e\u0907\u0928',
    'cos': '\u0915\u094b\u0938', 'Cos': '\u0915\u094b\u0938',
    'tan': '\u091f\u0948\u0928', 'Tan': '\u091f\u0948\u0928',
    'log': '\u0932\u0949\u0917', 'Log': '\u0932\u0949\u0917',
    'ln': '\u0932\u0928', 'Ln': '\u0932\u0928',
    
    // Single letters (as they appear in formulas) - only lowercase to avoid conflicts
    'f': '\u090f\u092b',
    'ma': '\u092e\u093e',
    'm': '\u090f\u092e',
    'v': '\u0935\u0940',
    'u': '\u092f\u0942',
    't': '\u091f\u0940',
    's': '\u090f\u0938',
    'c': '\u0938\u0940',
    'p': '\u092a\u0940',
    'e': '\u0908',
    'r': '\u0906\u0930',
    
    // Symbols in words
    'plus': '\u092a\u094d\u0932\u0938', 'Plus': '\u092a\u094d\u0932\u0938',
    'minus': '\u092e\u093e\u0907\u0928\u0938', 'Minus': '\u092e\u093e\u0907\u0928\u0938',
    'into': '\u0907\u0928\u091f\u0942', 'Into': '\u0907\u0928\u091f\u0942',
    'divided by': '\u0921\u093f\u0935\u093e\u0907\u0921\u0947\u0921 \u092c\u093e\u092f',
    'equals': '\u0907\u0915\u094d\u0935\u0932\u094d\u0938', 'Equals': '\u0907\u0915\u094d\u0935\u0932\u094d\u0938',
    'approximately': '\u0905\u092a\u094d\u0930\u0949\u0915\u094d\u0938\u0940\u092e\u0947\u091f\u0932\u0940', 'Approximately': '\u0905\u092a\u094d\u0930\u0949\u0915\u094d\u0938\u0940\u092e\u0947\u091f\u0932\u0940'
  };

  // Common Hinglish words to Devanagari
  const HINGLISH_TO_DEVNAGARI: Record<string, string> = {
    // Numbers
    '0': '\u0966', '1': '\u0967', '2': '\u0968', '3': '\u0969', '4': '\u096a', '5': '\u096b',
    '6': '\u096c', '7': '\u096d', '8': '\u096e', '9': '\u096f',

    // Common words (longest first to avoid partial matches)
    'kyunki': '\u0915\u094d\u092f\u094b\u0902\u0915\u093f',
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
    'in': '\u092e\u0947\u0902',
    'ka': '\u0915\u093e',
    'ke': '\u0915\u0947',
    'ki': '\u0915\u0940',
    'to': '\u0924\u094b',
    'par': '\u092a\u0930',
    'se': '\u0938\u0947'
  };

  let result = text;

  // First: Convert English scientific terms to Hindi pronunciation
  const englishKeys = Object.keys(ENGLISH_TO_HINDI).sort((a, b) => b.length - a.length);
  for (const eng of englishKeys) {
    const hindi = ENGLISH_TO_HINDI[eng];
    const pattern = new RegExp(`\\b${eng}\\b`, 'gi');
    result = result.replace(pattern, hindi);
  }

  // Second: Convert Hinglish to Devanagari (longest keys first)
  const hinglishKeys = Object.keys(HINGLISH_TO_DEVNAGARI).sort((a, b) => b.length - a.length);
  for (const hinglish of hinglishKeys) {
    const devanagari = HINGLISH_TO_DEVNAGARI[hinglish];
    const pattern = new RegExp(`\\b${hinglish}\\b`, 'gi');
    result = result.replace(pattern, devanagari);
  }

  // Clean up extra spaces
  return result.replace(/\s+/g, ' ').trim();
}

function cleanText(text: string): string {
  // Remove excessive spaces and fix punctuation gaps
  return text
    .replace(/\s+/g, ' ')                    // Multiple spaces -> single space
    .replace(/([.,!?])\s+/g, '$1 ')         // Single space AFTER punctuation
    .replace(/\s+([.,!?])/g, '$1')           // NO space BEFORE punctuation
    .trim();
}

// ========== TIER 1: HUGGING FACE (Indic-Parler-TTS - Best Hindi Quality) ==========
async function synthesizeHuggingFaceTTS(text: string): Promise<Blob | null> {
  if (!HF_TOKEN) {
    console.log("TIER 1 HF: HF_TOKEN is missing!");
    return null;
  }

  try {
    console.log("TIER 1 HF: Synthesizing text:", text.substring(0, 100));
    
    const response = await fetch(
      "https://api-inference.huggingface.co/models/ai4bharat/indic-parler-tts",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: text,
          parameters: {
            description: "Rohit's voice is clear and natural, with a moderate pace. The recording is of very high quality, with no background noise."
          }
        }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      }
    );

    console.log("TIER 1 HF: Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log("TIER 1 HF: FAILED - Status:", response.status, "Error:", errorText.substring(0, 200));
      
      // Check for rate limit (429)
      if (response.status === 429) {
        console.log("TIER 1 HF: Rate limited - falling back to Tier 2");
      }
      return null;
    }

    // Hugging Face returns audio as blob
    const audioBlob = await response.blob();
    console.log("TIER 1 HF: Audio generated, size:", audioBlob.size, "bytes");
    
    return audioBlob;
    
  } catch (e: any) {
    console.log("TIER 1 HF: Exception:", e?.message || String(e));
    return null;
  }
}

// ========== TIER 2: SARVAM AI (Shubh model v3 - Fallback) ==========
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
        pace: 1.1,  // 10% faster as requested
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
    rate: 1.1  // 10% faster as requested
  });
}

// ========== MAIN HANDLER ==========
export async function POST(req: NextRequest) {
  try {
    // Parse request
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

    // Clean text for better TTS
    text = cleanText(text);
    
    // Convert Hinglish to Devanagari with English terms in Hindi style
    text = convertHinglishToDevanagari(text);
    
    console.log("After Hinglish conversion:", text.substring(0, 100));

    // Generate cache key
    const cacheKey = await generateCacheKey(text);
    
    // Clean up cache periodically
    cleanupCache();
    
    // Check cache first - THIS IS CRITICAL FOR AVOIDING DUPLICATE REQUESTS
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 86400000) {
      console.log("CACHE HIT for text:", text.substring(0, 50), "| Saved API call!");
      return new Response(cached.blob, {
        status: 200,
        headers: {
          "Content-Type": cached.blob.type || "audio/wav",
          "X-TTS-Tier": "cached",
          "X-Cache": "HIT",
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    console.log("\n=== TTS REQUEST START ===");
    console.log("Original text:", text.substring(0, 200));
    console.log("HF_TOKEN present:", !!HF_TOKEN);
    console.log("SARVAM_API_KEY present:", !!SARVAM_API_KEY);
    console.log("========================\n");

    let blob: Blob | null = null;
    let tier: string = "none";

    // ===== TIER 1: HUGGING FACE (Indic-Parler-TTS) =====
    console.log("--- Trying TIER 1: Hugging Face (Indic-Parler-TTS, Rohit voice) ---");
    blob = await synthesizeHuggingFaceTTS(text);
    if (blob) {
      tier = "1";
      console.log("SUCCESS: Tier 1 Hugging Face\n");
    } else {
      // ===== TIER 2: SARVAM (Shubh v3) =====
      console.log("\n--- Trying TIER 2: Sarvam AI (Shubh v3, pace=1.1) ---");
      blob = await synthesizeSarvamTTS(text);
      if (blob) {
        tier = "2";
        console.log("SUCCESS: Tier 2 Sarvam AI\n");
      } else {
        // ===== TIER 3: DEVICE NATIVE =====
        console.log("\n--- Falling back to TIER 3: Device Native (rate=1.1) ---");
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
      }
    }

    // Cache the result for 24 hours - THIS PREVENTS DUPLICATE REQUESTS FOR SAME TEXT
    if (blob) {
      ttsCache.set(cacheKey, { blob, timestamp: Date.now(), text });
      console.log("CACHED audio for text:", text.substring(0, 50), "| Future requests will use cache!");
    }

    // Return the audio
    return new Response(blob!, {
      status: 200,
      headers: {
        "Content-Type": blob?.type || "audio/wav",
        "X-TTS-Tier": tier,
        "X-Cache": "MISS",
        "Cache-Control": "public, max-age=86400"
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
