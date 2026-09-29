// app/api/admin/send-notification/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { title, body, action_url, target_audience } = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { error: "Title and body are required" },
        { status: 400 }
      );
    }

    // Check if Firebase FCM Server Key is provided in Environment
    const fcmServerKey = process.env.FCM_SERVER_KEY;

    if (fcmServerKey) {
      // Broadcast via FCM legacy / v1 topic or tokens
      const topic = target_audience === "all" ? "all_students" : `${target_audience}_students`;

      await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: `/topics/${topic}`,
          notification: {
            title,
            body,
            click_action: action_url || "/",
          },
          data: {
            url: action_url || "/",
          },
        }),
      });
    }

    return NextResponse.json({ success: true, message: "Push triggered" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
