// lib/ai-key-manager.ts

interface KeyHealth {
  cooldownUntil: number;
  failureCount: number;
}

const keyHealthMap = new Map<string, KeyHealth>();
const COOLDOWN_MS = 60 * 1000;

function cleanKey(raw?: string): string {
  if (!raw) return "";
  return raw.replace(/["'\r\n\s]/g, "").trim();
}

/**
 * Chat Doubt Gemini Keys:
 * Sabhi keys ko priority order mein collect karta hai:
 * 1. Dedicated Doubt Keys (GEMINI_API_KEY_DOUBT ya GEMINI_API_KEY_DOUT)
 * 2. 5 Fresh Project Keys (GEMINI_API_KEYS)
 * 3. Fallback GEMINI_API_KEY / LIVE_GEMINI_API_KEYS
 */
export function getChatGeminiKeys(): string[] {
  const keys: string[] = [];

  const add = (k?: string) => {
    const cleaned = cleanKey(k);
    if (cleaned && !keys.includes(cleaned)) {
      keys.push(cleaned);
    }
  };

  // 1. Dedicated Doubt key
  add(process.env.GEMINI_API_KEY_DOUBT || process.env.GEMINI_API_KEY_DOUT);

  // 2. 5 Fresh project keys pool (Top priority)
  const poolRaw = process.env.GEMINI_API_KEYS || "";
  if (poolRaw) {
    poolRaw.split(",").forEach((k) => add(k));
  }

  // 3. Main standard key
  add(process.env.GEMINI_API_KEY);

  // 4. Live keys as emergency reserve
  const liveRaw = process.env.LIVE_GEMINI_API_KEYS || "";
  if (liveRaw) {
    liveRaw.split(",").forEach((k) => add(k));
  }

  return keys;
}

export function getLiveGeminiKeys(): string[] {
  const raw = process.env.LIVE_GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || "";
  return raw.split(",").map((k) => cleanKey(k)).filter(Boolean);
}

export function getGroqKey(): string {
  return cleanKey(process.env.GROQ_API_KEY || process.env.GROK_API_KEY);
}

export function getOpenRouterKey(): string {
  return cleanKey(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY);
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
