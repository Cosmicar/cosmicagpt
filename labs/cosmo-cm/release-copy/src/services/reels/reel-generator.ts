import { CampaignOutput } from "@/types/campaign";
import { ReelStructure, VisualScene } from "@/types/visual";
import { visualPromptEngine } from "@/services/visual/visual-prompt-engine";

export class ReelGenerator {
  generateReel(campaign: CampaignOutput): ReelStructure {
    const scenes: VisualScene[] = [
      {
        id: 1,
        duration: "0-3s",
        visual: "Hook cinematográfico. " + campaign.visualPrompt.description,
        audio: "Bass drop profundo con efecto de interferencia digital.",
        transition: "Glitch cut rápido",
        textOverlay: campaign.title.toUpperCase(),
      },
      {
        id: 2,
        duration: "3-8s",
        visual: "Problema/Dolor. Escena de alto contraste mostrando el desafío.",
        audio: "Sintetizadores rítmicos ascendentes.",
        transition: "Dissolve tecnológico",
        textOverlay: "¿Cansado de lo manual?",
      },
      {
        id: 3,
        duration: "8-15s",
        visual: "Transformación. La solución Cósmica en acción con partículas digitales.",
        audio: "Melodía futurista inspiradora.",
        transition: "Light leak azul",
        textOverlay: "OPTIMIZA CON IA",
      },
      {
        id: 4,
        duration: "15-20s",
        visual: "CTA final. Logo Cósmica con resplandor neón.",
        audio: "Outro limpio con eco.",
        transition: "Fade to black",
        textOverlay: campaign.cta,
      },
    ];

    const cinematicPrompts = scenes.map(scene => 
      visualPromptEngine.generateCinematicPrompt(scene.visual, campaign.visualPrompt.style)
    );

    return {
      id: Math.random().toString(36).substr(2, 9),
      campaign_id: "unknown",
      scenes,
      totalDuration: "20s",
      musicSuggestion: "Phonk Tecnológico / Cyberpunk Synthwave",
      visualEnergy: "Alta, dinámica, frenética",
      cinematicPrompts,
    };
  }
}

export const reelGenerator = new ReelGenerator();
