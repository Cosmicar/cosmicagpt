import { CampaignOutput } from "@/types/campaign";
import { WhatsAppStatusStructure } from "@/types/visual";

export class WhatsAppStatusGenerator {
  generateStatus(campaign: CampaignOutput): WhatsAppStatusStructure {
    return {
      id: Math.random().toString(36).substr(2, 9),
      campaign_id: "unknown",
      shortVersion: campaign.title,
      immediateImpact: "Tipografía Bold extragrande sobre fondo de video oscuro",
      giantText: campaign.title.split(' ').join('\n').toUpperCase(),
      quickCta: "Link en el primer comentario / Responde 'INFO'",
      verticalVisualStyle: "Vertical 9:16, centrado, con partículas digitales Cósmica",
    };
  }
}

export const whatsappStatusGenerator = new WhatsAppStatusGenerator();
