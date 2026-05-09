import { metaClient } from "./meta-client";
import { loggerEngine } from "@/services/logging/logger-engine";

export class MetaPublishingService {
  async publishToFacebook(message: string, link?: string, imageUrl?: string) {
    const pageId = metaClient.getPageId();
    if (!pageId) throw new Error("META_PAGE_ID not configured.");

    loggerEngine.info(`Publishing to Facebook Page: ${pageId}`);

    const endpoint = `${pageId}/${imageUrl ? 'photos' : 'feed'}`;
    const payload: any = { message };

    if (imageUrl) {
      payload.url = imageUrl;
    } else if (link) {
      payload.link = link;
    }

    return await metaClient.post(endpoint, payload);
  }

  async publishToInstagram(imageUrl: string, caption: string) {
    const igId = metaClient.getInstagramId();
    if (!igId) throw new Error("META_INSTAGRAM_ID not configured.");

    loggerEngine.info(`Publishing to Instagram: ${igId}`);

    // 1. Create Media Container
    const containerResult = await metaClient.post(`${igId}/media`, {
      image_url: imageUrl,
      caption: caption,
    });

    if (!containerResult || !containerResult.id) {
      throw new Error("Failed to create IG media container");
    }

    // 2. Publish Container
    return await metaClient.post(`${igId}/media_publish`, {
      creation_id: containerResult.id,
    });
  }
}

export const publishingService = new MetaPublishingService();
