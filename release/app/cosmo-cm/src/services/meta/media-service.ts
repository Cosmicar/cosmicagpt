import { metaClient } from "./meta-client";
import { loggerEngine } from "@/services/logging/logger-engine";

export class MetaMediaService {
  async uploadVideoToFacebook(videoUrl: string, description: string) {
    const pageId = metaClient.getPageId();
    if (!pageId) throw new Error("META_PAGE_ID not configured.");

    loggerEngine.info(`Uploading video to Facebook Page: ${pageId}`);

    const endpoint = `${pageId}/videos`;
    return await metaClient.post(endpoint, {
      file_url: videoUrl,
      description: description
    });
  }

  async createInstagramReelContainer(videoUrl: string, caption: string) {
    const igId = metaClient.getInstagramId();
    if (!igId) throw new Error("META_INSTAGRAM_ID not configured.");

    loggerEngine.info(`Creating Reels container for IG: ${igId}`);

    return await metaClient.post(`${igId}/media`, {
      media_type: "REELS",
      video_url: videoUrl,
      caption: caption,
    });
  }

  // Used to poll the status of a video/reel container before publishing
  async checkMediaStatus(containerId: string) {
    loggerEngine.info(`Checking media status for container: ${containerId}`);
    // implementation for GET /{container_id}?fields=status_code
    return { status_code: "FINISHED" }; 
  }
}

export const mediaService = new MetaMediaService();
