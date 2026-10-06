// lib/ai-key-manager.ts

interface KeyStatus {
  key: string;
  cooldownUntil: number;
}

const keyPool: Map<string, KeyStatus> = new Map();

/**
 * Strips quotes, spaces, newlines from API keys
 */
function cleanKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/["'\r\n]/g, "").trim();
  return cleaned.length > 10 ? cleaned : null;
}

/**
 * Cloudflare environment se saari Gemini keys nikalta hai aur clean karta hai
 */
export function getAllAvailableGeminiKeys(): string[] {
  const keys: string[] = [];

  const commaSeparated = [
    process.env.LIVE_GEMINI_API_KEYS,
    process.env.GEMINI_API_KEYS,
  ];

  for (const raw of commaSeparated) {
    if (raw) {
      // Split by comma and strip quotes from each key
      const parts = raw.split(",").map((k) => cleanKey(k)).filter(Boolean) as string[];
      keys.push(...parts);
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

  for (const raw of individualVars) {
    const k = cleanKey(raw);
    if (k && !keys.includes(k)) {
      keys.push(k);
    }
  }

  return keys;
}

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

export function getActiveChatKey(): string | null {
  const doubtKey = cleanKey(process.env.GEMINI_API_KEY_DOUBT);
  const now = Date.now();
  if (doubtKey) {
    const st = keyPool.get(doubtKey);
    if (!st || st.cooldownUntil <= now) return doubtKey;
  }
  return getActiveLiveKey();
}

export function markKeyRateLimited(key: string, cooldownMinutes = 60) {
  keyPool.set(key, {
    key,
    cooldownUntil: Date.now() + cooldownMinutes * 60 * 1000,
  });
}

export function getBackupProviders() {
  return {
    groq: cleanKey(process.env.GROQ_API_KEY),
    openRouter: cleanKey(process.env.OPENROUTER_API_KEY),
  };
}
