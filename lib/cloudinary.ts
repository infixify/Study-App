// lib/cloudinary.ts

/**
 * Optimizes media URLs:
 * 1. If relative path (GitHub /public): Returns as-is (delivered free via Cloudflare Pages).
 * 2. If Cloudinary: Injects f_auto, q_auto, w_180 and routes via Cloudflare Edge Proxy.
 */
export function optimizeMediaUrl(url: string | null | undefined, width: number = 180): string {
  if (!url || typeof url !== "string") return "";

  const trimmed = url.trim();

  // If local GitHub asset (/stickers/..., /memes/...)
  if (trimmed.startsWith("/") || !trimmed.startsWith("http")) {
    return trimmed;
  }

  // If Cloudinary URL
  if (trimmed.includes("res.cloudinary.com") && trimmed.includes("/image/upload/")) {
    let optimized = trimmed;
    if (!trimmed.includes("/f_auto,q_auto") && !trimmed.includes("/f_auto/")) {
      optimized = trimmed.replace(
        "/image/upload/",
        `/image/upload/f_auto,q_auto,w_${width},c_limit/`
      );
    }
    // Route via Cloudflare Edge proxy to save 100% Cloudinary repeat bandwidth
    return `/api/media-proxy?url=${encodeURIComponent(optimized)}`;
  }

  return trimmed;
}
