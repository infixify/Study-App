// app/api/admin/send-notification/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
  if (!data.access_token) {
    throw new Error(`Google OAuth failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const supabaseAsUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: userData, error: userErr } = await supabaseAsUser.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const { data: isAdmin, error: adminErr } = await supabaseAsUser.rpc("is_admin");
    if (adminErr || !isAdmin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { title, body, action_url } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "Title and body required" }, { status: 400 });
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Firebase env vars missing on server. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Vercel." },
        { status: 500 }
      );
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tokens, error: tokenErr } = await supabaseAdmin
      .from("user_fcm_tokens")
      .select("token, user_id");

    if (tokenErr) {
      console.error("Failed to fetch FCM tokens:", tokenErr);
      return NextResponse.json({ error: "DB token fetch failed" }, { status: 500 });
    }

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No FCM tokens in user_fcm_tokens table. No devices to send to.",
        devicesReached: 0,
      });
    }

    let fcmSuccessCount = 0;
    const fcmErrors: string[] = [];

    for (const t of tokens) {
      try {
        const fcmRes = await fetch(
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
        const fcmData = await fcmRes.json();
        if (fcmRes.ok) {
          fcmSuccessCount++;
        } else {
          // Token may be expired/unregistered — clean it up
          if (
            fcmData?.error?.details?.some(
              (d: any) => d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT"
            )
          ) {
            await supabaseAdmin.from("user_fcm_tokens").delete().eq("token", t.token);
          }
          fcmErrors.push(`token ${t.token.slice(0, 20)}...: ${JSON.stringify(fcmData?.error)}`);
          console.error("FCM send error for token:", fcmData);
        }
      } catch (e: any) {
        fcmErrors.push(e.message);
        console.error("FCM network error:", e);
      }
    }

    return NextResponse.json({
      success: true,
      devicesReached: fcmSuccessCount,
      totalTokens: tokens.length,
      errors: fcmErrors.length > 0 ? fcmErrors : undefined,
    });
  } catch (error: any) {
    console.error("FCM Send Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
