export interface VisualScene {
  id: number;
  duration: string;
  visual: string;
  audio: string;
  transition: string;
  textOverlay: string;
}

export interface CinematicPrompt {
  mj_prompt: string;
  stable_diffusion_prompt: string;
  runway_gen2_prompt: string;
  camera_movement: string;
  lighting: string;
  energy: string;
}

export interface ReelStructure {
  id: string;
  campaign_id: string;
  scenes: VisualScene[];
  totalDuration: string;
  musicSuggestion: string;
  visualEnergy: string;
  cinematicPrompts: CinematicPrompt[];
}

export interface FlyerStructure {
  id: string;
  campaign_id: string;
  headline: string;
  layoutDistribution: string;
  colorPalette: string[];
  blockStructure: string[];
  visualCta: string;
  graphicStyle: string;
  visualPrompt: string;
}

export interface WhatsAppStatusStructure {
  id: string;
  campaign_id: string;
  shortVersion: string;
  immediateImpact: string;
  giantText: string;
  quickCta: string;
  verticalVisualStyle: string;
}

export type VisualStyle = "cyberpunk" | "minimalist" | "holographic" | "futuristic_tech" | "space_noir";
