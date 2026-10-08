import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Your API keys from Cloudflare
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;
const HF_TOKEN = process.env.HF_TOKEN;

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================
const CACHE_NAME = "tts-audio-cache";
const CACHE_TTL = 86400; // 24 hours in seconds

// ============================================================================
// HINDI-ENGLISH TO DEVANAGARI CONVERTER
// ============================================================================

function convertHinglishToDevanagari(text: string): string {
  const ENGLISH_TO_HINDI: Record<string, string> = {
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
    result = result.replace(new RegExp(`\\b${eng}\\b`, 'gi'), ENGLISH_TO_HINDI[eng]);
  }
  const hinglishKeys = Object.keys(HINGLISH_TO_DEVNAGARI).sort((a, b) => b.length - a.length);
  for (const hinglish of hinglishKeys) {
    result = result.replace(new RegExp(`\\b${hinglish}\\b`, 'gi'), HINGLISH_TO_DEVNAGARI[hinglish]);
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
// CACHE KEY GENERATION
// ============================================================================
async function generateCacheKey(text: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================================
// IN-MEMORY CACHE WITH GLOBAL PERSISTENCE
// Using globalThis to share cache across requests in same worker
// ============================================================================
const GLOBAL = globalThis as any;
if (!GLOBAL.__ttsGlobalCache) {
  GLOBAL.__ttsGlobalCache = new Map<string, { blob: Blob; timestamp: number }>();
}
const memoryCache = GLOBAL.__ttsGlobalCache;

// Cleanup old entries periodically
function cleanupMemoryCache() {
  const now = Date.now();
  const TTL = 86400000; // 24 hours
  const MAX_SIZE = 200;
  
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > TTL) {
      memoryCache.delete(key);
    }
  }
  
  if (memoryCache.size > MAX_SIZE) {
    const entries = Array.from(memoryCache.entries()) as Array<[string, { blob: Blob; timestamp: number }]>;
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const recent = entries.slice(0, MAX_SIZE);
    memoryCache.clear();
    for (const [k, v] of recent) {
      memoryCache.set(k, v);
    }
  }
}

// ============================================================================
// TTS SYNTHESIS FUNCTIONS
// ============================================================================

async function callHuggingFace(text: string): Promise<Blob | null> {
  if (!HF_TOKEN) return null;
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/ai4bharat/indic-parler-tts",
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          inputs: text,
          parameters: { description: "Rohit's voice is clear and natural, with a moderate pace. The recording is of very high quality, with no background noise." }
        }),
        signal: AbortSignal.timeout(30000)
      }
    );
    if (!res.ok) {
      if (res.status === 429) console.log("[HF RATE LIMIT]");
      return null;
    }
    return await res.blob();
  } catch (e) {
    console.log("[HF ERROR]", e);
    return null;
  }
}

async function callSarvam(text: string): Promise<Blob | null> {
  if (!SARVAM_API_KEY) return null;
  try {
    const res = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-subscription-key": SARVAM_API_KEY },
      body: JSON.stringify({ text, language_code: "hi-IN", speaker: "shubh", pace: 1.1, speech_sample_rate: 24000, model: "bulbul:v3" }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const audio = data.audios?.[0] || data.audio;
    if (audio) return new Blob([Buffer.from(audio, "base64")], { type: "audio/wav" });
  } catch (e) {
    console.log("[SARVAM ERROR]", e);
  }
  return null;
}

// ============================================================================
// MAIN TTS FUNCTION WITH DEDUPLICATION
// ============================================================================

// Track pending requests to prevent duplicate API calls
const pending: Map<string, Promise<Blob>> = new Map();

async function getTTS(text: string): Promise<Blob> {
  const cacheKey = await generateCacheKey(text);
  
  // 1. Check memory cache
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 86400000) {
    console.log("[MEMORY CACHE HIT]", text.substring(0, 40));
    return cached.blob;
  }
  
  // 2. Check if same request is already in progress
  if (pending.has(cacheKey)) {
    console.log("[DEDUP]", text.substring(0, 40));
    return await pending.get(cacheKey)!;
  }
  
  // 3. Create new request
  console.log("[NEW API CALL]", text.substring(0, 40));
  const promise = (async () => {
    let blob: Blob | null = null;
    
    // Try Tier 1
    blob = await callHuggingFace(text);
    if (blob) { console.log("[TIER 1 OK]"); return blob; }
    
    // Try Tier 2
    blob = await callSarvam(text);
    if (blob) { console.log("[TIER 2 OK]"); return blob; }
    
    // Fallback to Tier 3
    console.log("[TIER 3 FALLBACK]");
    const json = JSON.stringify({ type: "native", text, voice: "hi-IN-MadhurNeural", rate: 1.1 });
    return new Blob([json], { type: "application/json" });
  })();
  
  pending.set(cacheKey, promise);
  const result = await promise;
  pending.delete(cacheKey);
  
  // Cache the result
  memoryCache.set(cacheKey, { blob: result, timestamp: Date.now() });
  cleanupMemoryCache();
  
  return result;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    let text: string | null = null;
    try {
      const body = await req.json();
      text = body.text?.trim() || null;
    } catch {
      const { searchParams } = new URL(req.url);
      text = searchParams.get("text")?.trim() ?? null;
    }
    
    if (!text) return new NextResponse("Missing text", { status: 400 });
    
    // Process text
    text = cleanText(text);
    text = convertHinglishToDevanagari(text);
    
    // Get TTS with caching and deduplication
    const blob = await getTTS(text);
    
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": blob.type,
        "Cache-Control": blob.type === "application/json" ? "no-store" : "public, max-age=86400"
      }
    });
  } catch (err: any) {
    console.log("ERROR:", err?.message || String(err));
    return new NextResponse("TTS error: " + (err?.message || String(err)), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
