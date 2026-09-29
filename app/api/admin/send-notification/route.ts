// app/api/admin/send-notification/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper: Generate Google OAuth2 Token from Service Account without heavy SDK
async function getGoogleAccessToken(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  // Web Crypto Sign JWT
  const b64Url = (obj: any) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

  const unsignedToken = `${b64Url(header)}.${b64Url(claimSet)}`;

  const crypto = await import("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsignedToken);
  const signature = sign
    .sign(privateKey.replace(/\\n/g, "\n"), "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = await res.json();
  return data.access_token;
}

export async function POST(req: Request) {
  try {
    const { title, body, action_url, target_audience } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "Title and body required" }, { status: 400 });
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    let fcmSuccessCount = 0;

    if (projectId && clientEmail && privateKey) {
      // 1. Get Access Token
      const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

      // 2. Fetch target device tokens from Supabase
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: tokens } = await supabaseAdmin
        .from("user_fcm_tokens")
        .select("token");

      if (tokens && tokens.length > 0) {
        // Send to individual device tokens
        for (const t of tokens) {
          try {
            await fetch(
              `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  message: {
                    token: t.token,
                    notification: { title, body },
                    data: { url: action_url || "/" },
                  },
                }),
              }
            );
            fcmSuccessCount++;
          } catch (e) {}
        }
      } else {
        // Broadcast to Firebase Topic
        const topic = target_audience === "all" ? "all_students" : `${target_audience}_students`;
        await fetch(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              message: {
                topic,
                notification: { title, body },
                data: { url: action_url || "/" },
              },
            }),
          }
        );
        fcmSuccessCount = 1;
      }
    }

    return NextResponse.json({
      success: true,
      fcmConfigured: Boolean(projectId && clientEmail && privateKey),
      devicesReached: fcmSuccessCount,
    });
  } catch (error: any) {
    console.error("FCM Send Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
