import { NextResponse } from "next/server";
import { publishingService } from "@/services/meta/publishing-service";
import { loggerEngine } from "@/services/logging/logger-engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, platform, imageUrl } = body;

    if (!message || !platform) {
      return NextResponse.json({ error: "Missing required fields: message, platform" }, { status: 400 });
    }

    let result;

    if (platform === "facebook") {
      result = await publishingService.publishToFacebook(message, undefined, imageUrl);
    } else if (platform === "instagram") {
      if (!imageUrl) {
        return NextResponse.json({ error: "Instagram requires an image URL" }, { status: 400 });
      }
      result = await publishingService.publishToInstagram(imageUrl, message);
    } else {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    loggerEngine.info(`[PublishTest] Successfully published to ${platform}`);
    return NextResponse.json({ success: true, id: result.id });

  } catch (error: any) {
    loggerEngine.error("[PublishTest] Failed to publish", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
