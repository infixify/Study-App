// lib/ai-key-manager.ts

interface KeyStatus {
  key: string;
  cooldownUntil: number; // timestamp
  failureCount: number;
}

function loadGeminiKeys(): string[] {
  const keys: string[] = [];

  // Comma separated list
  if (process.env.GEMINI_API_KEYS) {
    const split = process.env.GEMINI_API_KEYS.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    keys.push(...split);
  }

  // Individual numbered keys: GEMINI_API_KEY_1 to 10
  for (let i = 1; i <= 10; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && !keys.includes(k.trim())) keys.push(k.trim());
  }

  // Fallback single key
  const fallback = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (fallback && !keys.includes(fallback.trim())) {
    keys.unshift(fallback.trim());
  }

  return keys;
}

// In-Memory Key State Pool
const keyPool: Map<string, KeyStatus> = new Map();

function initPool() {
  const allKeys = loadGeminiKeys();
  allKeys.forEach((key) => {
    if (!keyPool.has(key)) {
      keyPool.set(key, { key, cooldownUntil: 0, failureCount: 0 });
    }
  });
}

/**
 * Returns an active, healthy key that is not in cooldown
 */
export function getActiveGeminiKey(): string | null {
  initPool();
  const now = Date.now();
  const available: string[] = [];

  for (const [key, status] of keyPool.entries()) {
    if (status.cooldownUntil <= now) {
      available.push(key);
    }
  }

  if (available.length === 0) {
    // If all keys are in cooldown, reset the oldest one to prevent complete outage
    let oldestKey: string | null = null;
    let minCooldown = Infinity;
    for (const [key, status] of keyPool.entries()) {
      if (status.cooldownUntil < minCooldown) {
        minCooldown = status.cooldownUntil;
        oldestKey = key;
      }
    }
    return oldestKey;
  }

  // Pick random from healthy keys for even load balancing
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Excludes a key on Rate Limit (429) for specified minutes (default 60 mins)
 */
export function markKeyRateLimited(key: string, cooldownMinutes: number = 60) {
  const status = keyPool.get(key) || { key, cooldownUntil: 0, failureCount: 0 };
  status.cooldownUntil = Date.now() + cooldownMinutes * 60 * 1000;
  status.failureCount += 1;
  keyPool.set(key, status);
  console.warn(`[AI-Key-Manager] Key ...${key.slice(-5)} rate-limited. Excluded for ${cooldownMinutes}m.`);
}
