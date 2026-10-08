import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Your API keys from Cloudflare
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;
const HF_TOKEN = process.env.HF_TOKEN;

// ============================================================================
// GLOBAL STATE - Persists across requests in the same Cloudflare worker
// ============================================================================

// Cache: textHash -> { blob, timestamp, text }
const GLOBAL_CACHE = globalThis as any;
if (!GLOBAL_CACHE.__ttsCache) {
  GLOBAL_CACHE.__ttsCache = new Map<string, { blob: Blob; timestamp: number; text: string }>();
}
const ttsCache: Map<string, { blob: Blob; timestamp: number; text: string }> = GLOBAL_CACHE.__ttsCache;

// Pending requests: cacheKey -> Promise<Blob>
// This prevents concurrent identical requests from hitting the API multiple times
const pendingRequests: Map<string, Promise<Blob>> = new Map();

// Request counter for periodic cleanup
if (!GLOBAL_CACHE.__ttsRequestCount) {
  GLOBAL_CACHE.__ttsRequestCount = 0;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clean up old cache entries to prevent memory bloat
 * Called periodically (every 50 requests)
 */
function cleanupCache() {
  GLOBAL_CACHE.__ttsRequestCount = (GLOBAL_CACHE.__ttsRequestCount || 0) + 1;
  
  // Only clean every 50 requests to avoid performance overhead
  if (GLOBAL_CACHE.__ttsRequestCount % 50 !== 0) return;
  
  const now = Date.now();
  const CACHE_TTL = 86400000; // 24 hours in ms
  const MAX_CACHE_SIZE = 100;
  
  // Remove expired entries
  for (const [key, value] of ttsCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      ttsCache.delete(key);
    }
  }
  
  // Limit cache size
  if (ttsCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(ttsCache.entries())
      .sort((a: any, b: any) => b[1].timestamp - a[1].timestamp)
      .slice(0, MAX_CACHE_SIZE);
    
    ttsCache.clear();
    for (const [key, value] of entries) {
      ttsCache.set(key, value);
    }
  }
}

/**
 * Generate a consistent cache key from text using SHA-256
 */
async function generateCacheKey(text: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// HINDI-ENGLISH TO DEVANAGARI CONVERTER
// ============================================================================

/**
 * Converts Hinglish to pure Devanagari Hindi for correct pronunciation.
 * For English scientific terms, converts them to their Hindi pronunciation style.
 */
function convertHinglishToDevanagari(text: string): string {
  const ENGLISH_TO_HINDI: Record<string, string> = {
    // Scientific terms (longest first)
    'Newton': '\u0928\u094d\u092f\u0942\u091f\u0928',
    'Einstein': '\u0906\u0907\u0902\u0938\u094d\u091f\u0940\u0928',
    'Physics': '\u092b\u093f\u091c\u093f\u0915\u094d\u0938',
    'Maths': '\u092e\u0948\u0925\u094d\u0938',
    'Chemistry': '\u0915\u0947\u092e\u093f\u0938\u094d\u091f\u094d\u0930\u0940',
    'Biology': '\u092c\u093e\u092f\u094b\u0932\u0949\u091c\u0940',
    'force': '\u092b\u094b\u0930\u094d\u0938', 'Force': '\u092b\u094b\u0930\u094d\u0938',
    'mass': '\u092e\u093e\u0938', 'Mass': '\u092e\u093e\u0938',
    'acceleration': '\u090f\u0915\u094d\u0938\u0947\u0932\u0930\u0947\u0936\u0928',
    'velocity': '\u0935\u0947\u0932\u0949\u0938\u093f\u091f\u0940',
    'energy': '\u090f\u0928\u0930\u094d\u091c\u0940',
    'power': '\u092a\u093e\u0935\u0930',
    'law': '\u0932\u0949',
    'theorem': '\u0925\u0940\u092f\u094b\u0930\u092e',
    'formula': '\u092b\u0949\u0930\u094d\u092e\u0942\u0932\u093e',
    'equation': '\u0907\u0915\u094d\u0935\u0947\u0936\u0928',
    'graph': '\u0917\u094d\u0930\u093e\u092b',
    'diagram': '\u0921\u093e\u092f\u0917\u094d\u0930\u093e\u092e',
    'cm': '\u0938\u0947\u0902\u091f\u0940\u092e\u0940\u091f\u0930',
    'mm': '\u092e\u093f\u0932\u0940\u092e\u0940\u091f\u0930',
    'kg': '\u0915\u093f\u0932\u094b\u0917\u094d\u0930\u093e\u092e',
    'm/s': '\u092e\u0940\u091f\u0930 \u092a\u094d\u0930\u0924\u093f \u0938\u0947\u0915\u0902\u0921',
    'joule': '\u091c\u0942\u0932',
    'newton_unit': '\u0928\u094d\u092f\u0942\u091f\u0928',
    'watt': '\u0935\u093e\u091f',
    'volt': '\u0935\u094b\u0932\u094d\u091f',
    'ampere': '\u090f\u092e\u094d\u092a\u093f\u092f\u0930',
    'sin': '\u0938\u093e\u0907\u0928',
    'cos': '\u0915\u094b\u0938',
    'tan': '\u091f\u0948\u0928',
    'log': '\u0932\u0949\u0917',
    'ln': '\u0932\u0928',
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
    'plus': '\u092a\u094d\u0932\u0938',
    'minus': '\u092e\u093e\u0907\u0928\u0938',
    'into': '\u0907\u0928\u091f\u0942',
    'divided by': '\u0921\u093f\u0935\u093e\u0907\u0921\u0947\u0921 \u092c\u093e\u092f',
    'equals': '\u0907\u0915\u094d\u0935\u0932\u094d\u0938',
    'approximately': '\u0905\u092a\u094d\u0930\u0949\u0915\u094d\u0938\u0940\u092e\u0947\u091f\u0932\u0940'
  };

  const HINGLISH_TO_DEVNAGARI: Record<string, string> = {
    '0': '\u0966', '1': '\u0967', '2': '\u0968', '3': '\u0969', '4': '\u096a',
    '5': '\u096b', '6': '\u096c', '7': '\u096d', '8': '\u096e', '9': '\u096f',
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

  const englishKeys = Object.keys(ENGLISH_TO_HINDI).sort((a, b) => b.length - a.length);
  for (const eng of englishKeys) {
    const hindi = ENGLISH_TO_HINDI[eng];
    result = result.replace(new RegExp(`\\b${eng}\\b`, 'gi'), hindi);
  }

  const hinglishKeys = Object.keys(HINGLISH_TO_DEVNAGARI).sort((a, b) => b.length - a.length);
  for (const hinglish of hinglishKeys) {
    const devanagari = HINGLISH_TO_DEVNAGARI[hinglish];
    result = result.replace(new RegExp(`\\b${hinglish}\\b`, 'gi'), devanagari);
  }

  return result.replace(/\s+/g, ' ').trim();
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/([.,!?])\s+/g, '$1 ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

// ============================================================================
// TTS SYNTHESIS FUNCTIONS
// ============================================================================

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
        signal: AbortSignal.timeout(30000)
      }
    );

    console.log("TIER 1 HF: Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log("TIER 1 HF: FAILED - Status:", response.status, "Error:", errorText.substring(0, 200));
      if (response.status === 429) {
        console.log("TIER 1 HF: Rate limited - falling back to Tier 2");
      }
      return null;
    }

    const audioBlob = await response.blob();
    console.log("TIER 1 HF: Audio generated, size:", audioBlob.size, "bytes");
    return audioBlob;
    
  } catch (e: any) {
    console.log("TIER 1 HF: Exception:", e?.message || String(e));
    return null;
  }
}

async function synthesizeSarvamTTS(text: string): Promise<Blob | null> {
  if (!SARVAM_API_KEY) {
    console.log("TIER 2 SARVAM: API KEY MISSING");
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
        pace: 1.1,
        speech_sample_rate: 24000,
        model: "bulbul:v3",
      }),
      signal: AbortSignal.timeout(15000)
    });

    console.log("TIER 2 SARVAM: Response status:", res.status);
    
    if (res.ok) {
      const data = await res.json();
      console.log("TIER 2 SARVAM: Response received");
      
      if (data.audios?.[0]) {
        const audio = Buffer.from(data.audios[0], "base64");
        console.log("TIER 2 SARVAM: Audio generated, size:", audio.length, "bytes");
        return new Blob([audio], { type: "audio/wav" });
      } else if (data.audio) {
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

function getNativeTTSResponse(text: string): string {
  return JSON.stringify({
    type: "native",
    text: text,
    voice: "hi-IN-MadhurNeural",
    rate: 1.1
  });
}

// ============================================================================
// CORE TTS FUNCTION WITH BUILT-IN CACHING AND DEDUPLICATION
// ============================================================================

/**
 * Get TTS audio for text with caching and request deduplication
 * This is the SINGLE entry point for all TTS synthesis
 */
async function getTTSAudio(text: string): Promise<{ blob: Blob; tier: string } | null> {
  // Generate cache key
  const cacheKey = await generateCacheKey(text);
  
  // === STEP 1: Check cache ===
  const cached = ttsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 86400000) {
    console.log("[CACHE HIT] for:", text.substring(0, 50));
    return { blob: cached.blob, tier: "cached" };
  }
  
  // === STEP 2: Check for pending request (deduplication) ===
  if (pendingRequests.has(cacheKey)) {
    console.log("[DEDUP] Waiting for pending request for:", text.substring(0, 50));
    const existingPromise = pendingRequests.get(cacheKey)!;
    const result = await existingPromise;
    
    // The pending request should have cached the result, but let's verify
    const cachedAfter = ttsCache.get(cacheKey);
    if (cachedAfter) {
      return { blob: cachedAfter.blob, tier: cachedAfter.blob.type.includes("json") ? "native" : "cached" };
    }
    
    // Fallback: return the result directly
    return { blob: result, tier: "deduped" };
  }
  
  // === STEP 3: Create pending request promise ===
  console.log("[NEW REQUEST] for:", text.substring(0, 50));
  
  const ttsPromise = (async (): Promise<Blob> => {
    let blob: Blob | null = null;
    let tier: string = "none";
    
    // Try Tier 1: Hugging Face
    blob = await synthesizeHuggingFaceTTS(text);
    if (blob) {
      tier = "1";
      console.log("[TIER 1 SUCCESS] Hugging Face");
    } else {
      // Try Tier 2: Sarvam
      blob = await synthesizeSarvamTTS(text);
      if (blob) {
        tier = "2";
        console.log("[TIER 2 SUCCESS] Sarvam AI");
      } else {
        // Fallback to Tier 3: Native
        console.log("[TIER 3 FALLBACK] Device Native");
        const nativeJson = getNativeTTSResponse(text);
        blob = new Blob([nativeJson], { type: "application/json" });
        tier = "3";
      }
    }
    
    // Cache the result
    if (blob) {
      ttsCache.set(cacheKey, { blob, timestamp: Date.now(), text });
      console.log("[CACHED] tier:", tier);
    }
    
    return blob!;
  })();
  
  // Store the promise for deduplication
  pendingRequests.set(cacheKey, ttsPromise);
  
  try {
    const blob = await ttsPromise;
    return { blob, tier: blob.type.includes("json") ? "3" : "1" };
  } finally {
    // Clean up pending request
    pendingRequests.delete(cacheKey);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

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

    // Clean and convert text
    text = cleanText(text);
    text = convertHinglishToDevanagari(text);
    
    console.log("Processed text:", text.substring(0, 100));
    
    // Clean up cache periodically
    cleanupCache();

    // Get TTS audio (with built-in caching and deduplication)
    const result = await getTTSAudio(text);
    
    if (!result) {
      console.log("TTS: Failed to generate audio");
      return new NextResponse("Failed to generate audio", { status: 500 });
    }

    // Return the audio
    return new Response(result.blob, {
      status: 200,
      headers: {
        "Content-Type": result.blob.type || "audio/wav",
        "X-TTS-Tier": result.tier,
        "X-Cache": result.tier === "cached" || result.tier === "deduped" ? "HIT" : "MISS",
        "Cache-Control": result.tier === "3" ? "no-store" : "public, max-age=86400"
      }
    });

  } catch (err: any) {
    console.log("TTS HANDLER ERROR:", err?.message || String(err));
    return new NextResponse("TTS error: " + (err?.message || String(err)), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
