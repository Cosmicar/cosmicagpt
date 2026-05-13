import { CinematicPrompt } from "@/types/visual";

export class VisualPromptEngine {
  generateCinematicPrompt(description: string, style: string): CinematicPrompt {
    const baseStyle = "cinematic, hyper-realistic, 8k, octane render, unreal engine 5, volumetic lighting, moody atmosphere";
    const branding = "Cósmica Tech Branding, electric blue and vibrant orange neon accents, space-tech aesthetic, digital particles, futuristic HUD elements";

    return {
      mj_prompt: `/imagine prompt: ${description}, ${style}, ${baseStyle}, ${branding}, --ar 16:9 --v 6.0`,
      stable_diffusion_prompt: `${description}, ${style}, ${baseStyle}, ${branding}, detailed eyes, intricate details, masterwork`,
      runway_gen2_prompt: `Cinematic pan, ${description}, ${branding}, slow motion, 4k resolution`,
      camera_movement: "Slow tracking shot with subtle zoom-in, cinematic depth of field",
      lighting: "High contrast, rim lighting, glowing neon highlights, soft shadows",
      energy: "High energy, dynamic digital flux, pulsing energy streams",
    };
  }
}

export const visualPromptEngine = new VisualPromptEngine();
