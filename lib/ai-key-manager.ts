// lib/ai-key-manager.ts

interface KeyStatus {
  key: string;
  cooldownUntil: number;
}

const keyPool: Map<string, KeyStatus> = new Map();

function getLiveKeys(): string[] {
  const keys: string[] = [];
  if (process.env.LIVE_GEMINI_API_KEYS) {
    keys.push(
      ...process.env.LIVE_GEMINI_API_KEYS.split(",")
        .map((k) => k.trim())
        .filter(Boolean)
    );
  }
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`LIVE_GEMINI_API_KEY_${i}`];
    if (k && !keys.includes(k.trim())) keys.push(k.trim());
  }
  return keys;
}

/**
 * Live Doubt Solver ke liye 5 keys ke pool se active key uthata hai
 */
export function getActiveLiveKey(): string | null {
  const all = getLiveKeys();
  const now = Date.now();
  const available = all.filter((k) => {
    const st = keyPool.get(k);
    return !st || st.cooldownUntil <= now;
  });

  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }

  // Fallback to common backup
  return process.env.GEMINI_API_KEY || null;
}

/**
 * Normal Chat/Photo Doubt ke liye key nikalta hai
 */
export function getActiveChatKey(): string | null {
  const doubtKey = process.env.GEMINI_API_KEY_DOUBT;
  const now = Date.now();

  if (doubtKey) {
    const st = keyPool.get(doubtKey);
    if (!st || st.cooldownUntil <= now) return doubtKey;
  }

  // Fallback to Common Backup
  const commonKey = process.env.GEMINI_API_KEY;
  if (commonKey) {
    const st = keyPool.get(commonKey);
    if (!st || st.cooldownUntil <= now) return commonKey;
  }

  // If both rate limited, try any healthy Live key
  return getActiveLiveKey();
}

/**
 * Rate-limited (429) key ko 60 min ke liye blacklist/exclude karta hai
 */
export function markKeyRateLimited(key: string, cooldownMinutes = 60) {
  keyPool.set(key, {
    key,
    cooldownUntil: Date.now() + cooldownMinutes * 60 * 1000,
  });
  console.warn(`[KeyManager] Key ...${key.slice(-5)} rate-limited. Excluded for ${cooldownMinutes}m.`);
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
