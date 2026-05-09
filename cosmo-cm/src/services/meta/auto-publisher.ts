import { supabase } from "@/lib/supabase/client";
import { publishingService } from "./publishing-service";
import { loggerEngine } from "@/services/logging/logger-engine";
import { tokenService } from "./auth/token-service";
import { ScheduledPost } from "@/types/schedule";
import { CampaignRecord } from "@/types/campaign";

export class AutoPublisher {
  async publishScheduledPost(post: ScheduledPost) {
    const { id, workspace_id, campaign_id, platform } = post;
    
    loggerEngine.info(`[AutoPublisher] Iniciando publicación para post ${id} en ${platform}`);

    // 1. Actualizar estado a 'publishing'
    await supabase
      .from("scheduled_posts")
      .update({ status: "publishing" })
      .eq("id", id);

    try {
      const isTestMode = process.env.TEST_MODE === "true";
      
      if (isTestMode) {
        loggerEngine.info(`[AutoPublisher] [MODO TEST] Simulando publicación para post ${id}`);
      }

      // 2. Obtener token de Meta
      const token = await tokenService.getActiveToken(workspace_id);
      
      // Validación Tarea 3
      if (!token && !isTestMode) {
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
        if (isTestMode) {
          loggerEngine.info(`[AutoPublisher] [MODO TEST] Simulado: Publicando en Facebook`, { copy: campaign.copy });
          result = { id: `test_fb_${Date.now()}` };
        } else {
          result = await this.publishFacebookPost(campaign as CampaignRecord);
        }
      } else if (platform.toLowerCase() === "instagram") {
        let imageUrl = campaign.visual_prompt?.imageUrl || campaign.visual_prompt?.url;
        
        // Validación Tarea 3
        if (!imageUrl && !isTestMode) {
            throw new Error("Instagram requiere una imagen para publicar.");
        }

        if (isTestMode) {
          loggerEngine.info(`[AutoPublisher] [MODO TEST] Simulado: Publicando en Instagram`, { caption: campaign.copy, imageUrl });
          result = { id: `test_ig_${Date.now()}` };
        } else {
          result = await this.publishInstagramPost(campaign as CampaignRecord);
        }
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
          failed_at: new Date().toISOString()
        })
        .eq("id", id);
    }
  }

  async publishFacebookPost(campaign: CampaignRecord) {
    const message = campaign.copy;
    let imageUrl: string | undefined = undefined;

    if (campaign.visualPrompt && typeof campaign.visualPrompt === 'object') {
        imageUrl = campaign.visualPrompt.imageUrl || campaign.visualPrompt.url || undefined;
    }

    return await publishingService.publishToFacebook(message, undefined, imageUrl);
  }

  async publishInstagramPost(campaign: CampaignRecord) {
    const caption = `${campaign.copy}\n\n${campaign.hashtags}`;
    let imageUrl: string | undefined = undefined;

    if (campaign.visualPrompt && typeof campaign.visualPrompt === 'object') {
        imageUrl = campaign.visualPrompt.imageUrl || campaign.visualPrompt.url || undefined;
    }

    if (!imageUrl) {
        throw new Error("Instagram requiere una imagen para publicar.");
    }

    return await publishingService.publishToInstagram(imageUrl, caption);
  }
}

export const autoPublisher = new AutoPublisher();
