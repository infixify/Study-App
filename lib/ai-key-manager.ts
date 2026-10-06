// lib/ai-key-manager.ts

interface KeyHealth {
  cooldownUntil: number;
  failureCount: number;
}

const keyHealthMap = new Map<string, KeyHealth>();
const COOLDOWN_MS = 60 * 1000;

export function cleanKey(raw?: string): string {
  if (!raw) return "";
  return raw.replace(/["'\r\n\s]/g, "").trim();
}

/**
 * CHAT DOUBT KEYS:
 * Strictly dedicated Chat keys.
 * 5 Live Keys (GEMINI_API_KEYS) are 100% EXCLUDED.
 */
export function getChatGeminiKeys(): string[] {
  const keys: string[] = [];

  const add = (k?: string) => {
    const cleaned = cleanKey(k);
    if (cleaned && !keys.includes(cleaned)) {
      keys.push(cleaned);
    }
  };

  // 1. Dedicated Doubt Keys (both spellings)
  add(process.env.GEMINI_API_KEY_DOUBT || process.env.GOOGLE_API_KEY_DOUBT);
  add(process.env.GEMINI_API_KEY_DOUT || process.env.GOOGLE_API_KEY_DOUT);

  // 2. Main Standard Key
  add(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_KEY);

  return keys;
}

/**
 * LIVE CAM / VIDEO KEYS (5 separate project keys pool):
 */
export function getLiveGeminiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.LIVE_GEMINI_API_KEYS || "";
  return raw.split(",").map((k) => cleanKey(k)).filter(Boolean);
}

export function getGroqKey(): string {
  return cleanKey(process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.GROQ_KEY);
}

export function getOpenRouterKey(): string {
  return cleanKey(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY || process.env.OPENROUTER_KEY);
}

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

// Backwards-compatible aliases
export function getActiveLiveKey(): string | null {
  return getHealthyKey(getLiveGeminiKeys());
}

export function getActiveChatKey(): string | null {
  return getHealthyKey(getChatGeminiKeys());
}

export function getAllAvailableGeminiKeys(): string[] {
  return Array.from(new Set([...getChatGeminiKeys(), ...getLiveGeminiKeys()]));
}

export function markKeyRateLimited(key: string) {
  reportKeyFailure(key, true);
}

export function getBackupProviders() {
  return {
    groq: getGroqKey(),
    openrouter: getOpenRouterKey(),
  };
}
