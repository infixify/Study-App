import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text")?.trim();
    if (!text) {
      return new NextResponse("Missing text parameter", { status: 400 });
    }

    // Clean text: strip asterisks, latex delimiters & symbols for clean human speech
    const cleanText = text
      .replace(/[*#`_~\[\]()]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    const encoded = encodeURIComponent(cleanText);
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=hi&client=tw-ob`;

    const res = await fetch(googleTtsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      return new NextResponse("TTS generation failed", { status: res.status });
    }

    const audioBuffer = await res.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return new NextResponse("TTS error", { status: 500 });
  }
}
