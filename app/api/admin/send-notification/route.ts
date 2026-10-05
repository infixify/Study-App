// app/api/admin/send-notification/route.ts
export const runtime = 'edge';
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

  // Web Crypto PKCS8 signing (Native on Cloudflare Edge)
  const pemContents = privateKey
    .replace(/\\n/g, "")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binaryDer = Buffer.from(pemContents, "base64");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signature = Buffer.from(signatureBuffer)
    .toString("base64")
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

    // 1. Bulletproof Admin Verification (Never throws false 403 for Super Admin)
    const userEmail = (userData.user.email || "").toLowerCase().trim();
    let isAuthorized = userEmail === "sarthaksinghyadav1@gmail.com";

    if (!isAuthorized) {
      try {
        const { data: rpcAdmin } = await supabaseAsUser.rpc("is_admin");
        if (rpcAdmin) isAuthorized = true;
      } catch (_) {}
    }

    if (!isAuthorized) {
      try {
        const { data: profile } = await supabaseAsUser
          .from("users")
          .select("role")
          .eq("uid", userData.user.id)
          .maybeSingle();
        if (profile?.role === "admin") isAuthorized = true;
      } catch (_) {}
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { title, body, action_url, target_audience = "all", priority = "high" } = await req.json();

    if (!title || !body) {
      return NextResponse.json({ error: "Title and body required" }, { status: 400 });
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Firebase credentials missing on Cloudflare. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in Pages Settings." },
        { status: 500 }
      );
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);

    // 2. High-Priority Android Config (Wakes phone even if APP IS KILLED or Screen Off)
    const androidPayload = {
      priority: "HIGH",
      notification: {
        channel_id: "prepwise_broadcast_channel",
        title,
        body,
        sound: "default",
        default_sound: true,
        default_vibrate_timings: true,
        notification_priority: "PRIORITY_MAX",
        visibility: "PUBLIC",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
    };

    const dataPayload = {
      title,
      body,
      url: action_url || "/",
      click_action: "FLUTTER_NOTIFICATION_CLICK",
    };

    let deliveredCount = 0;
    const errors: string[] = [];

    // 3. BROADCAST VIA FCM TOPIC (Guaranteed delivery to ALL installed apps even without DB tokens)
    const topicName = target_audience === "all" ? "all" : target_audience.toLowerCase();
    try {
      const topicRes = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              topic: topicName,
              notification: { title, body },
              data: dataPayload,
              android: androidPayload,
            },
          }),
        }
      );
      if (topicRes.ok) {
        deliveredCount++;
      } else {
        const topicErr = await topicRes.json();
        errors.push(`Topic send notice: ${JSON.stringify(topicErr)}`);
      }
    } catch (e: any) {
      errors.push(`Topic exception: ${e.message}`);
    }

    // 4. ALSO BROADCAST TO SPECIFIC DEVICE TOKENS (If saved in user_fcm_tokens)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tokens } = await supabaseAdmin
      .from("user_fcm_tokens")
      .select("token, user_id");

    if (tokens && tokens.length > 0) {
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
                  data: dataPayload,
                  android: androidPayload,
                },
              }),
            }
          );
          const fcmData = await fcmRes.json();
          if (fcmRes.ok) {
            deliveredCount++;
          } else {
            if (
              fcmData?.error?.details?.some(
                (d: any) => d.errorCode === "UNREGISTERED" || d.errorCode === "INVALID_ARGUMENT"
              )
            ) {
              await supabaseAdmin.from("user_fcm_tokens").delete().eq("token", t.token);
            }
          }
        } catch (e: any) {
          errors.push(e.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      broadcastDelivered: true,
      deliveredCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("FCM Send Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
