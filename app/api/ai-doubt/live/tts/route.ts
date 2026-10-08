import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// API keys
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;
const HF_TOKEN = process.env.HF_TOKEN;

// ============================================================================
// TEXT PROCESSING (Hinglish to Devanagari + Cleaning)
// ============================================================================

function convertHinglishToDevanagari(text: string): string {
  const ENGLISH_TO_HINDI: Record<string, string> = {
    'Newton': '\u0928\u094d\u092f\u0942\u091f\u0928', 'Einstein': '\u0906\u0907\u0902\u0938\u094d\u091f\u0940\u0928',
    'Physics': '\u092b\u093f\u091c\u093f\u0915\u094d\u0938', 'Maths': '\u092e\u0948\u0925\u094d\u0938',
    'Chemistry': '\u0915\u0947\u092e\u093f\u0938\u094d\u091f\u094d\u0930\u0940', 'Biology': '\u092c\u093e\u092f\u094b\u0932\u0949\u091c\u0940',
    'force': '\u092b\u094b\u0930\u094d\u0938', 'mass': '\u092e\u093e\u0938',
    'acceleration': '\u090f\u0915\u094d\u0938\u0947\u0932\u0930\u0947\u0936\u0928',
    'velocity': '\u0935\u0947\u0932\u0949\u0938\u093f\u091f\u0940', 'energy': '\u090f\u0928\u0930\u094d\u091c\u0940',
    'power': '\u092a\u093e\u0935\u0930', 'law': '\u0932\u0949', 'theorem': '\u0925\u0940\u092f\u094b\u0930\u092e',
    'formula': '\u092b\u0949\u0930\u094d\u092e\u0942\u0932\u093e', 'equation': '\u0907\u0915\u094d\u0935\u0947\u0936\u0928',
    'graph': '\u0917\u094d\u0930\u093e\u092b', 'diagram': '\u0921\u093e\u092f\u0917\u094d\u0930\u093e\u092e',
    'cm': '\u0938\u0947\u0902\u091f\u0940\u092e\u0940\u091f\u0930', 'mm': '\u092e\u093f\u0932\u0940\u092e\u0940\u091f\u0930',
    'kg': '\u0915\u093f\u0932\u094b\u0917\u094d\u0930\u093e\u092e',
    'm/s': '\u092e\u0940\u091f\u0930 \u092a\u094d\u0930\u0924\u093f \u0938\u0947\u0915\u0902\u0921',
    'joule': '\u091c\u0942\u0932', 'newton_unit': '\u0928\u094d\u092f\u0942\u091f\u0928',
    'watt': '\u0935\u093e\u091f', 'volt': '\u0935\u094b\u0932\u094d\u091f', 'ampere': '\u090f\u092e\u094d\u092a\u093f\u092f\u0930',
    'sin': '\u0938\u093e\u0907\u0928', 'cos': '\u0915\u094b\u0938', 'tan': '\u091f\u0948\u0928',
    'log': '\u0932\u0949\u0917', 'ln': '\u0932\u0928',
    'f': '\u090f\u092b', 'ma': '\u092e\u093e', 'm': '\u090f\u092e', 'v': '\u0935\u0940',
    'u': '\u092f\u0942', 't': '\u091f\u0940', 's': '\u090f\u0938', 'c': '\u0938\u0940',
    'p': '\u092a\u0940', 'e': '\u0908', 'r': '\u0906\u0930',
    'plus': '\u092a\u094d\u0932\u0938', 'minus': '\u092e\u093e\u0907\u0928\u0938',
    'into': '\u0907\u0928\u091f\u0942',
    'divided by': '\u0921\u093f\u0935\u093e\u0907\u0921\u0947\u0921 \u092c\u093e\u092f',
    'equals': '\u0907\u0915\u094d\u0935\u0932\u094d\u0938',
    'approximately': '\u0905\u092a\u094d\u0930\u0949\u0915\u094d\u0938\u0940\u092e\u0947\u091f\u0932\u0940'
  };
  const HINGLISH_TO_DEVNAGARI: Record<string, string> = {
    '0': '\u0966', '1': '\u0967', '2': '\u0968', '3': '\u0969', '4': '\u096a',
    '5': '\u096b', '6': '\u096c', '7': '\u096d', '8': '\u096e', '9': '\u096f',
    'kyunki': '\u0915\u094d\u092f\u094b\u0902\u0915\u093f', 'isliye': '\u0907\u0938\u0932\u093f\u090f',
    'lekin': '\u0932\u0947\u0915\u093f\u0928', 'nahi': '\u0928\u0939\u0940\u0902',
    'aur': '\u0914\u0930', 'hai': '\u0939\u0948', 'mein': '\u092e\u0947\u0902', 'bhi': '\u092d\u0940',
    'jab': '\u091c\u092c', 'tab': '\u0924\u092c', 'agar': '\u0905\u0917\u0930', 'toh': '\u0924\u094b',
    'yani': '\u092f\u093e\u0928\u0940', 'ye': '\u092f\u0947', 'wa': '\u0935\u093e', 'wo': '\u0935\u094b',
    'in': '\u092e\u0947\u0902', 'ka': '\u0915\u093e', 'ke': '\u0915\u0947', 'ki': '\u0915\u0940',
    'to': '\u0924\u094b', 'par': '\u092a\u0930', 'se': '\u0938\u0947'
  };
  let result = text;
  const eKeys = Object.keys(ENGLISH_TO_HINDI).sort((a, b) => b.length - a.length);
  for (const k of eKeys) result = result.replace(new RegExp(`\\b${k}\\b`, 'gi'), ENGLISH_TO_HINDI[k]);
  const hKeys = Object.keys(HINGLISH_TO_DEVNAGARI).sort((a, b) => b.length - a.length);
  for (const k of hKeys) result = result.replace(new RegExp(`\\b${k}\\b`, 'gi'), HINGLISH_TO_DEVNAGARI[k]);
  return result.replace(/\s+/g, ' ').trim();
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/([.,!?])\s+/g, '$1 ').replace(/\s+([.,!?])/g, '$1').trim();
}

// ============================================================================
// CACHE KEY GENERATION (SHA-256 hash of processed text)
// ============================================================================
async function getCacheKey(text: string): Promise<string> {
  const processed = cleanText(convertHinglishToDevanagari(text));
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(processed));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ============================================================================
// TTS SYNTHESIS (3-Tier with automatic fallback)
// ============================================================================

async function callTier1(text: string): Promise<Blob | null> {
  if (!HF_TOKEN) return null;
  try {
    const res = await fetch("https://api-inference.huggingface.co/models/ai4bharat/indic-parler-tts", {
      method: "POST",
      headers: { "Authorization": `Bearer ${HF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: text, parameters: { description: "Rohit's voice is clear and natural, with a moderate pace. The recording is of very high quality, with no background noise." } }),
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch { return null; }
}

async function callTier2(text: string): Promise<Blob | null> {
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
  } catch { return null; }
  return null;
}

// ============================================================================
// IN-MEMORY DEDUPLICATION (per worker instance)
// ============================================================================
const pending: Map<string, Promise<Blob>> = new Map();

// ============================================================================
// MAIN HANDLER - Uses GET for Cloudflare Edge Cache
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text");
    
    if (!text) {
      return new NextResponse("Missing text parameter. Use: /api/ai-doubt/live/tts?text=YOUR_TEXT", { status: 400 });
    }
    
    // Generate cache key from text
    const cacheKey = await getCacheKey(text);
    
    // Check if same request is already in progress in this worker
    if (pending.has(cacheKey)) {
      console.log("[DEDUP] Waiting for existing request");
      const blob = await pending.get(cacheKey)!;
      return new Response(blob, {
        status: 200,
        headers: { "Content-Type": blob.type, "Cache-Control": "public, max-age=86400" }
      });
    }
    
    // Create new request
    console.log("[NEW REQUEST] Processing text");
    const promise = (async () => {
      let blob: Blob | null = null;
      const processedText = cleanText(convertHinglishToDevanagari(text));
      
      // Try Tier 1
      blob = await callTier1(processedText);
      if (blob) { console.log("[TIER 1 OK]"); return blob; }
      
      // Try Tier 2
      blob = await callTier2(processedText);
      if (blob) { console.log("[TIER 2 OK]"); return blob; }
      
      // Fallback to Tier 3
      console.log("[TIER 3 FALLBACK]");
      const json = JSON.stringify({ type: "native", text: processedText, voice: "hi-IN-MadhurNeural", rate: 1.1 });
      return new Blob([json], { type: "application/json" });
    })();
    
    pending.set(cacheKey, promise);
    const blob = await promise;
    pending.delete(cacheKey);
    
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": blob.type,
        "Cache-Control": blob.type === "application/json" ? "no-store" : "public, max-age=86400"
      }
    });
    
  } catch (err: any) {
    console.log("ERROR:", err?.message || String(err));
    return new NextResponse("Error: " + (err?.message || String(err)), { status: 500 });
  }
}

// POST handler - redirects to GET with text in query for caching
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
    
    // Redirect to GET with text in URL so Cloudflare can cache it
    const url = new URL(req.url);
    url.searchParams.set("text", text);
    
    // Make the GET request internally
    const getReq = new Request(url.toString(), { method: "GET" });
    return GET(getReq as NextRequest);
    
  } catch (err: any) {
    return new NextResponse("Error: " + (err?.message || String(err)), { status: 500 });
  }
}
