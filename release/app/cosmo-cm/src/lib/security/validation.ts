import { z } from "zod";

// Campaign Generation Schema Validation
export const campaignInputSchema = z.object({
  servicio: z.string().min(3).max(100),
  objetivo: z.string().min(3).max(100),
  plataforma: z.enum(["Instagram", "LinkedIn", "TikTok", "Twitter", "Facebook"]),
  formato: z.enum(["Reel", "Carrusel", "Post Estático", "Story", "Video Largo"]),
  tono: z.string().min(3).max(50),
  promocion: z.string().max(200).optional(),
  contexto: z.string().max(500).optional(),
});

export const validateCampaignInput = (data: unknown) => {
  return campaignInputSchema.safeParse(data);
};

// Sanitization utility
export const sanitizeInput = (input: string): string => {
  if (!input) return "";
  // Basic XSS prevention by stripping HTML tags
  return input.replace(/<[^>]*>?/gm, '');
};
