// lib/ai-key-manager.ts

interface KeyStatus {
  key: string;
  cooldownUntil: number;
}

const keyPool: Map<string, KeyStatus> = new Map();

/**
 * Cloudflare environment se saari Gemini keys nikalta hai
 */
export function getAllAvailableGeminiKeys(): string[] {
  const keys: string[] = [];

  const commaSeparated = [
    process.env.LIVE_GEMINI_API_KEYS,
    process.env.GEMINI_API_KEYS,
  ];

  for (const raw of commaSeparated) {
    if (raw) {
      keys.push(...raw.split(",").map((k) => k.trim()).filter(Boolean));
    }
  }

  const individualVars = [
    process.env.GEMINI_API_KEY_DOUBT,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_MENTOR,
    process.env.NEXT_PUBLIC_GEMINI_API_KEY,
  ];

  for (let i = 1; i <= 5; i++) {
    individualVars.push(process.env[`LIVE_GEMINI_API_KEY_${i}`]);
    individualVars.push(process.env[`GEMINI_API_KEY_${i}`]);
  }

  for (const k of individualVars) {
    if (k && k.trim() && !keys.includes(k.trim())) {
      keys.push(k.trim());
    }
  }

  return keys;
}

/**
 * Live Doubt ke liye active key uthata hai
 */
export function getActiveLiveKey(): string | null {
  const allKeys = getAllAvailableGeminiKeys();
  const now = Date.now();
  const available = allKeys.filter((k) => {
    const st = keyPool.get(k);
    return !st || st.cooldownUntil <= now;
  });
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return allKeys.length > 0 ? allKeys[0] : null;
}

/**
 * Normal Chat/Photo Doubt ke liye active key uthata hai
 */
export function getActiveChatKey(): string | null {
  const doubtKey = process.env.GEMINI_API_KEY_DOUBT;
  const now = Date.now();
  if (doubtKey) {
    const st = keyPool.get(doubtKey);
    if (!st || st.cooldownUntil <= now) return doubtKey;
  }
  return getActiveLiveKey();
}

/**
 * General purpose key finder
 */
export function getActiveGeminiKeyForDoubt(): string | null {
  return getActiveLiveKey();
}

export function getActiveGeminiKey(): string | null {
  return getActiveLiveKey();
}

/**
 * Rate-limited (429) key ko cooldown mein daalna
 */
export function markKeyRateLimited(key: string, cooldownMinutes = 60) {
  keyPool.set(key, {
    key,
    cooldownUntil: Date.now() + cooldownMinutes * 60 * 1000,
  });
}

/**
 * Backup External Providers
 */
export function getBackupProviders() {
  return {
    groq: process.env.GROQ_API_KEY?.trim() || null,
    openRouter: process.env.OPENROUTER_API_KEY?.trim() || null,
  };
}

export function getBackupApiKey() {
  const groq = process.env.GROQ_API_KEY?.trim() || null;
  return { provider: groq ? ("groq" as const) : ("none" as const), key: groq };
}
