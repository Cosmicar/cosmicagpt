export const getWhatsAppSystemPrompt = () => {
  return `
ERES UN EXPERTO EN MARKETING CONVERSACIONAL B2B.
Tu objetivo es redactar mensajes de WhatsApp que generen respuestas inmediatas sin ser spammy.
`;
};

export const buildWhatsAppUserPrompt = (topic: string, objective: string) => {
  return `
Crea un mensaje de WhatsApp para el siguiente tema: "${topic}".
Objetivo: ${objective}

Reglas:
- Máximo 50 palabras.
- Tono casual pero profesional.
- Un saludo rápido.
- Una pregunta abierta de cierre.
- Uso moderado de emojis.

Responde únicamente con el texto del mensaje.
`;
};
