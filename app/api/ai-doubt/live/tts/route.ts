// app/api/ai-doubt/live/tts/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;

// ============================================================================
// SCRIPT AUTO-DETECTION: Unicode ranges -> BCP-47 language code for TTS tiers.
// Input text is already in native script (Gemini tts_text), so detection is reliable.
// ============================================================================
function detectLangCode(text: string): string {
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";
  if (/[\u0B00-\u0B7F]/.test(text)) return "or-IN";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN";
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  if (/[\u0600-\u06FF]/.test(text)) return "ur-IN";
  return "en-IN";
}

// Browser-native (Tier 3) voices per language
const NATIVE_VOICES: Record<string, string> = {
  "hi-IN": "hi-IN-MadhurNeural",
  "en-IN": "en-IN-PrabhatNeural",
  "bn-IN": "bn-IN-BashkarNeural",
  "gu-IN": "gu-IN-NiranjanNeural",
  "ta-IN": "ta-IN-PallaviNeural",
  "te-IN": "te-IN-MohanNeural",
  "kn-IN": "kn-IN-GaganNeural",
  "ml-IN": "ml-IN-MidhunNeural",
  "pa-IN": "pa-IN-PrabhatNeural",
  "or-IN": "or-IN-SubhasiniNeural",
};
const HF_TOKEN = process.env.HF_TOKEN;

// ============================================================================
// HELPER: Base64 to ArrayBuffer for Cloudflare Edge (Zero Node Buffer Dependency)
// ============================================================================
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

// ============================================================================
// TEXT PROCESSING (Hinglish to Devanagari + Cleaning)
// ============================================================================
function convertHinglishToDevanagari(text: string): string {
  const ENGLISH_TO_HINDI: Record<string, string> = {
    'Newton': 'न्यूटन', 'Einstein': 'आइंस्टीन',
    'Physics': 'फिजिक्स', 'Maths': 'मैथ्स',
    'Chemistry': 'केमिस्ट्री', 'Biology': 'बायोलॉजी',
    'force': 'फोर्स', 'mass': 'मास',
    'acceleration': 'एक्सेलरेशन',
    'velocity': 'वेलासिटी', 'energy': 'एनर्जी',
    'power': 'पावर', 'law': 'लॉ', 'theorem': 'थ्योरम',
    'formula': 'फ़ॉर्मूला', 'equation': 'इक्वेशन',
    'graph': 'ग्राफ', 'diagram': 'डायग्राम',
    'cm': 'सेंटीमीटर', 'mm': 'मिलीमीटर',
    'kg': 'किलोग्राम',
    'm/s': 'मीटर प्रति सेकंड',
    'joule': 'जूल', 'newton_unit': 'न्यूटन',
    'watt': 'वाट', 'volt': 'वोल्ट', 'ampere': 'एम्पियर',
    'sin': 'साइन', 'cos': 'कोस', 'tan': 'टेन',
    'log': 'लॉग', 'ln': 'लन',
    'f': 'एफ', 'ma': 'मा', 'm': 'एम', 'v': 'वी',
    'u': 'यू', 't': 'टी', 's': 'एस', 'c': 'सी',
    'p': 'पी', 'e': 'ई', 'r': 'आर',
    'plus': 'प्लस', 'minus': 'माइनस',
    'into': 'इनटू',
    'divided by': 'डिवाइडेड बाय',
    'equals': 'इक्वल्स',
    'approximately': 'अप्रोक्सिमेटली'
  };

  const HINGLISH_TO_DEVNAGARI: Record<string, string> = {
    '0': '०', '1': '१', '2': '२', '3': '३', '4': '४',
    '5': '५', '6': '६', '7': '७', '8': '८', '9': '९',
    'kyunki': 'क्योंकि', 'isliye': 'इसलिए',
    'lekin': 'लेकिन', 'nahi': 'नहीं',
    'aur': 'और', 'hai': 'है', 'mein': 'में', 'bhi': 'भी',
    'jab': 'जब', 'tab': 'तब', 'agar': 'अगर', 'toh': 'तो',
    'yani': 'यानी', 'ye': 'ये', 'wa': 'वा', 'wo': 'वो',
    'in': 'में', 'ka': 'का', 'ke': 'के', 'ki': 'की',
    'to': 'तो', 'par': 'पर', 'se': 'से'
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
  const processed = cleanText(text);
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
      body: JSON.stringify({ inputs: text, parameters: { description: "A clear and natural speaker delivers the speech at a moderate pace. The recording is of very high quality, with no background noise." } }),
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
      body: JSON.stringify({ text, language_code: detectLangCode(text), speaker: "shubh", pace: 1.1, speech_sample_rate: 24000, model: "bulbul:v3" }),
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const audio = data.audios?.[0] || data.audio;
    if (audio) {
      // Cloudflare Edge & TypeScript strict compatible blob creation
      const buffer = base64ToArrayBuffer(audio);
      return new Blob([buffer as any], { type: "audio/wav" });
    }
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
      // Input arrives in native script from Gemini tts_text; old dictionary
      // converter caused mispronunciations and is intentionally not applied.
      const processedText = cleanText(text);
      
      // Try Tier 1
      blob = await callTier1(processedText);
      if (blob) { console.log("[TIER 1 OK]"); return blob; }
      
      // Try Tier 2
      blob = await callTier2(processedText);
      if (blob) { console.log("[TIER 2 OK]"); return blob; }
      
      // Fallback to Tier 3
      console.log("[TIER 3 FALLBACK]");
      const lang = detectLangCode(processedText);
      const json = JSON.stringify({ type: "native", text: processedText, voice: NATIVE_VOICES[lang] || NATIVE_VOICES["hi-IN"], lang, rate: 1.1 });
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
