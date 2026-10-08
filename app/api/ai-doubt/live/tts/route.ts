import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

// Your API keys from Cloudflare
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || process.env.NEXT_PUBLIC_SARVAM_API_KEY;
const HF_TOKEN = process.env.HF_TOKEN;

// ========== IN-MEMORY CACHE (24-hour expiry) ==========
// Cache structure: Map<textHash, { blob: Blob, timestamp: number }>
const ttsCache = new Map<string, { blob: Blob; timestamp: number }>();

async function generateCacheKey(text: string): Promise<string> {
  // Create SHA-256 hash of text for consistent cache keys
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
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

    // Generate cache key
    const cacheKey = await generateCacheKey(text);
    
    // Check cache first
    const cached = ttsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 86400000) {
      console.log("CACHE HIT for text:", text.substring(0, 50));
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
    console.log("Input text:", text.substring(0, 200));
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

    // Cache the result for 24 hours
    if (blob) {
      ttsCache.set(cacheKey, { blob, timestamp: Date.now() });
      console.log("CACHED audio for text:", text.substring(0, 50));
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
