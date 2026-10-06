/**
 * AI Key & Provider Manager for PrepWise / EterPrep
 * Strict isolation:
 * - Live Cam Pool: GEMINI_API_KEYS (5 keys) strictly reserved for video
 * - Text Doubt: Groq -> Cloudflare Workers AI -> Gemini -> OpenRouter
 * - Image Doubt: Dedicated Gemini Image Key -> Groq Vision -> SambaNova -> Cloudflare Vision -> OpenRouter
 */

function sanitize(val?: string | null): string | null {
  if (!val) return null;
  const clean = val.replace(/["'\r\n]/g, "").trim();
  return clean.length > 5 ? clean : null;
}

// Dedicated Image Project Key (with smart fallback so it never fails)
export function getImageGeminiKeys(): string[] {
  const keys: string[] = [];
  const imgKey = sanitize(process.env.GEMINI_API_KEY_IMAGE || process.env.GOOGLE_API_KEY_IMAGE);
  if (imgKey) keys.push(imgKey);

  const doubtKey = sanitize(process.env.GEMINI_API_KEY_DOUBT || process.env.GOOGLE_API_KEY_DOUBT);
  if (doubtKey && !keys.includes(doubtKey)) keys.push(doubtKey);

  const mainKey = sanitize(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  if (mainKey && !keys.includes(mainKey)) keys.push(mainKey);

  return keys;
}

// Dedicated Text Project Key
export function getChatGeminiKeys(): string[] {
  const keys: string[] = [];
  const doubtKey = sanitize(process.env.GEMINI_API_KEY_DOUBT || process.env.GOOGLE_API_KEY_DOUBT);
  if (doubtKey) keys.push(doubtKey);

  const mainKey = sanitize(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  if (mainKey && !keys.includes(mainKey)) keys.push(mainKey);

  return keys;
}

export function getGroqKey(): string | null {
  return sanitize(process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY);
}

export function getSambaNovaKey(): string | null {
  return sanitize(process.env.SAMBANOVA_API_KEY || process.env.SAMBA_NOVA_API_KEY);
}

// Account 1: Text Doubts
export function getCloudflareWorkersAiConfig(): { accountId: string; apiToken: string } | null {
  const accountId = sanitize(process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID);
  const apiToken = sanitize(process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN);
  if (accountId && apiToken) return { accountId, apiToken };
  return null;
}

// Account 2: Dedicated Vision / Image Doubts
export function getCloudflareImageAiConfig(): { accountId: string; apiToken: string } | null {
  const accountId = sanitize(
    process.env.CLOUDFLARE_IMAGE_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID
  );
  const apiToken = sanitize(
    process.env.CLOUDFLARE_IMAGE_API_TOKEN ||
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN
  );
  if (accountId && apiToken) return { accountId, apiToken };
  return null;
}

export function getOpenRouterKey(): string | null {
  return sanitize(process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY);
}

// Live Cam pool strictly 100% reserved
export function getLiveGeminiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => sanitize(k))
    .filter((k): k is string => !!k);
}
