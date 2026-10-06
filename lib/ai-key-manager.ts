// lib/ai-key-manager.ts

interface KeyHealth {
  cooldownUntil: number;
  failureCount: number;
}

const keyHealthMap = new Map<string, KeyHealth>();
const COOLDOWN_MS = 60 * 1000; // 1 minute cooldown on 429 / rate-limit

function cleanKey(raw?: string): string {
  if (!raw) return "";
  return raw.replace(/["'\r\n\s]/g, "").trim();
}

/**
 * Chat Doubt ke liye dedicated keys:
 * 1. GEMINI_API_KEY_DOUBT ya GEMINI_API_KEY_DOUT
 * 2. Standard GEMINI_API_KEY
 * 3. GEMINI_API_KEYS pool (agar pehle wale busy hon)
 */
export function getChatGeminiKeys(): string[] {
  const keys: string[] = [];
  
  // 1. Dedicated Doubt Keys (dono spellings handled)
  const doubtKey = cleanKey(process.env.GEMINI_API_KEY_DOUBT || process.env.GEMINI_API_KEY_DOUT);
  if (doubtKey) keys.push(doubtKey);

  // 2. Standard Gemini Key
  const mainKey = cleanKey(process.env.GEMINI_API_KEY);
  if (mainKey && !keys.includes(mainKey)) keys.push(mainKey);

  // 3. Pool keys fallback
  const poolRaw = process.env.GEMINI_API_KEYS || "";
  if (poolRaw) {
    const pool = poolRaw.split(",").map(k => cleanKey(k)).filter(Boolean);
    for (const k of pool) {
      if (!keys.includes(k)) keys.push(k);
    }
  }

  return keys;
}

/**
 * Live Video Call ke liye dedicated keys (chheda nahi gaya)
 */
export function getLiveGeminiKeys(): string[] {
  const raw = process.env.LIVE_GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || "";
  return raw.split(",").map(k => cleanKey(k)).filter(Boolean);
}

/**
 * Groq Backup Key (GROQ_API_KEY ya GROK_API_KEY)
 */
export function getGroqKey(): string {
  return cleanKey(process.env.GROQ_API_KEY || process.env.GROK_API_KEY);
}

/**
 * OpenRouter Backup Key
 */
export function getOpenRouterKey(): string {
  return cleanKey(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY);
}

/**
 * Health check filters
 */
export function getHealthyKey(keys: string[]): string | null {
  const now = Date.now();
  for (const k of keys) {
    const health = keyHealthMap.get(k);
    if (!health || health.cooldownUntil < now) {
      return k;
    }
  }
  return keys[0] || null;
}

export function reportKeyFailure(key: string, isRateLimit: boolean = false) {
  if (!key) return;
  const current = keyHealthMap.get(key) || { cooldownUntil: 0, failureCount: 0 };
  current.failureCount += 1;
  if (isRateLimit || current.failureCount >= 2) {
    current.cooldownUntil = Date.now() + COOLDOWN_MS;
  }
  keyHealthMap.set(key, current);
}

export function reportKeySuccess(key: string) {
  if (!key) return;
  keyHealthMap.delete(key);
}
