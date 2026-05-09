import { CampaignOutput } from "@/types/campaign";
import { FlyerStructure } from "@/types/visual";

export class FlyerGenerator {
  generateFlyer(campaign: CampaignOutput): FlyerStructure {
    return {
      id: Math.random().toString(36).substr(2, 9),
      campaign_id: "unknown",
      headline: campaign.title,
      layoutDistribution: "Asimétrica, estilo editorial tecnológico, mucho espacio negativo",
      colorPalette: ["#3B82F6", "#FF6B00", "#000000", "#FFFFFF"],
      blockStructure: [
        "Header: Logo Cósmica alineado a la izquierda",
        "Hero: Imagen generada por IA en el centro",
        "Body: " + campaign.copy.substring(0, 100) + "...",
        "Footer: " + campaign.cta,
      ],
      visualCta: "Botón con efecto de brillo neón en la parte inferior derecha",
      graphicStyle: "Minimalista futurista con rejillas (grids) visibles",
      visualPrompt: campaign.visualPrompt.rawPrompt,
    };
  }
}

export const flyerGenerator = new FlyerGenerator();
