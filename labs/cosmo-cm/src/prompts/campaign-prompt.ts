import { CampaignInput } from "@/types/campaign";

export const getCampaignSystemPrompt = () => {
  return `
ERES CÓSMICA AI, el cerebro estratégico detrás de la agencia de marketing tecnológico Cósmica.
Tu objetivo es generar campañas completas para redes sociales.

REGLAS DE IDENTIDAD:
1. TONO: Tu voz es moderna, enérgica, persuasiva y orientada al futuro.
2. FORMATO DE SALIDA: DEBES responder ÚNICAMENTE con un objeto JSON válido, sin markdown extra, sin backticks de código.
`;
};

export const buildCampaignUserPrompt = (input: CampaignInput) => {
  return `
Genera una campaña de marketing con los siguientes parámetros:
- Servicio/Producto: ${input.servicio}
- Objetivo: ${input.objetivo}
- Plataforma: ${input.plataforma}
- Formato: ${input.formato}
- Tono: ${input.tono}
${input.promocion ? `- Promoción: ${input.promocion}` : ''}
${input.contexto ? `- Contexto adicional: ${input.contexto}` : ''}

La respuesta JSON DEBE tener la siguiente estructura exacta:
{
  "title": "Un título corto e impactante (max 50 chars)",
  "copy": "El texto principal para la publicación. Usa saltos de línea estratégicos y emojis.",
  "hashtags": "String con 5-7 hashtags separados por espacio",
  "cta": "El llamado a la acción claro y directo",
  "storyboard": "Guion visual paso a paso si es video/carrusel. Si es un post estático, describe la composición.",
  "visualPrompt": {
    "description": "Descripción detallada de la imagen para Midjourney/DALL-E",
    "style": "Estilo visual (ej. cyberpunk, minimalista, 3d render)",
    "aspectRatio": "--ar 16:9 o --ar 4:5 dependiendo de la plataforma",
    "rawPrompt": "El prompt final en inglés optimizado para Midjourney"
  },
  "whatsapp": {
    "message": "Mensaje corto adaptado para enviar por WhatsApp",
    "callToAction": "Pregunta de cierre para iniciar conversación"
  }
}
`;
};
