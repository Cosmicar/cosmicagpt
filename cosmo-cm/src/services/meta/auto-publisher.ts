import { supabase } from "@/lib/supabase/client";
import { publishingService } from "./publishing-service";
import { loggerEngine } from "@/services/logging/logger-engine";
import { tokenService } from "./auth/token-service";

export class AutoPublisher {
  async publishScheduledPost(post: any) {
    const { id, workspace_id, campaign_id, platform } = post;
    
    loggerEngine.info(`[AutoPublisher] Iniciando publicación para post ${id} en ${platform}`);

    // 1. Actualizar estado a 'publishing'
    await supabase
      .from("scheduled_posts")
      .update({ status: "publishing" })
      .eq("id", id);

    try {
      // 2. Obtener token de Meta
      const token = await tokenService.getActiveToken(workspace_id);
      if (!token) {
        throw new Error("No hay token de Meta válido o activo para este workspace.");
      }

      // 3. Obtener datos de la campaña
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaign_id)
        .single();

      if (campaignError || !campaign) {
        throw new Error(`No se pudo obtener la campaña asociada: ${campaignError?.message || "No encontrada"}`);
      }

      let result;

      // 4. Publicar según la plataforma
      if (platform.toLowerCase() === "facebook") {
        result = await this.publishFacebookPost(campaign);
      } else if (platform.toLowerCase() === "instagram") {
        result = await this.publishInstagramPost(campaign);
      } else {
        throw new Error(`Plataforma ${platform} no soportada para publicación automática.`);
      }

      // 5. Éxito
      loggerEngine.info(`[AutoPublisher] Post ${id} publicado con éxito en ${platform}`);
      await supabase
        .from("scheduled_posts")
        .update({ 
          status: "published", 
          published_at: new Date().toISOString(),
          error_message: null
        })
        .eq("id", id);

    } catch (error: any) {
      // 6. Fallo
      loggerEngine.error(`[AutoPublisher] Fallo al publicar post ${id}`, error);
      await supabase
        .from("scheduled_posts")
        .update({ 
          status: "failed", 
          error_message: error.message || "Error desconocido",
          failed_at: new Date().toISOString() // El usuario mencionó failed_at, lo agregamos en metadata o si existe el campo
        })
        .eq("id", id);
    }
  }

  async publishFacebookPost(campaign: any) {
    const message = campaign.copy;
    let imageUrl = null;

    // Intentar extraer imagen de visual_prompt si existe
    if (campaign.visual_prompt && typeof campaign.visual_prompt === 'object') {
        imageUrl = campaign.visual_prompt.imageUrl || campaign.visual_prompt.url;
    }

    return await publishingService.publishToFacebook(message, undefined, imageUrl);
  }

  async publishInstagramPost(campaign: any) {
    const caption = `${campaign.copy}\n\n${campaign.hashtags}`;
    let imageUrl = null;

    if (campaign.visual_prompt && typeof campaign.visual_prompt === 'object') {
        imageUrl = campaign.visual_prompt.imageUrl || campaign.visual_prompt.url;
    }

    if (!imageUrl) {
        throw new Error("Instagram requiere una imagen para publicar.");
    }

    return await publishingService.publishToInstagram(imageUrl, caption);
  }
}

export const autoPublisher = new AutoPublisher();
