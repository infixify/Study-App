// lib/cloudinary.ts

/**
 * Injects Cloudinary transformations (f_auto, q_auto, and optional width)
 * to minimize bandwidth by up to 90%.
 */
export function optimizeCloudinaryUrl(url: string | null | undefined, width: number = 240): string {
  if (!url || typeof url !== "string") return "";

  // Only apply to Cloudinary upload URLs
  if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
    return url;
  }

  // Already transformed?
  if (url.includes("/f_auto,q_auto") || url.includes("/f_auto/")) {
    return url;
  }

  // Insert transformations right after /upload/
  const transformParams = `f_auto,q_auto,w_${width},c_limit`;
  return url.replace("/image/upload/", `/image/upload/${transformParams}/`);
}
