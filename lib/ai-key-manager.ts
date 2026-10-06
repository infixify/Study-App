/**
 * AI Key & Provider Manager for PrepWise / EterPrep
 * Strict separation:
 * - Live Cam Doubt Pool: 5 dedicated keys (GEMINI_API_KEYS) strictly reserved for video
 * - Chat Doubt: Groq -> Cloudflare Workers AI -> Gemini -> OpenRouter
 */

export function getChatGeminiKeys(): string[] {
  const keys: string[] = [];

  const doubtKey =
    process.env.GEMINI_API_KEY_DOUBT ||
    process.env.GOOGLE_API_KEY_DOUBT ||
    process.env.GEMINI_API_KEY_DOUT;
  if (doubtKey && doubtKey.trim()) keys.push(doubtKey.trim());

  const mainKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (mainKey && mainKey.trim() && !keys.includes(mainKey.trim())) {
    keys.push(mainKey.trim());
  }

  return keys;
}

export function getGroqKey(): string | null {
  const key =
    process.env.GROQ_API_KEY ||
    process.env.GROK_API_KEY ||
    process.env.NEXT_PUBLIC_GROQ_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function getCloudflareWorkersAiConfig(): { accountId: string; apiToken: string } | null {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID;
  const apiToken =
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN ||
    process.env.CLOUDFLARE_WORKERS_AI_TOKEN;

  if (accountId && apiToken && accountId.trim() && apiToken.trim()) {
    return { accountId: accountId.trim(), apiToken: apiToken.trim() };
  }
  return null;
}

export function getOpenRouterKey(): string | null {
  const key =
    process.env.OPENROUTER_API_KEY ||
    process.env.OPEN_ROUTER_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function getLiveGeminiKeys(): string[] {
  // Live cam pool strictly untouched and reserved
  const raw = process.env.GEMINI_API_KEYS || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 5);
}
