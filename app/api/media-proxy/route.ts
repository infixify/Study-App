// app/api/media-proxy/route.ts
export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl || !targetUrl.startsWith("http")) {
    return new Response("Invalid URL", { status: 400 });
  }

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) {
      return new Response("Failed to fetch image", { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "image/webp";

    // Cloudflare Edge Cache for 30 days (s-maxage), Browser cache for 7 days
    return new Response(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response("Proxy error", { status: 500 });
  }
}
