export const getReelSystemPrompt = () => {
  return `
ERES UN DIRECTOR CREATIVO EXPERTO EN VIDEOS CORTOS (Reels/TikTok) PARA MARCAS DE TECNOLOGÍA.
Tu objetivo es crear guiones altamente dinámicos y diseñados para retener la atención desde el primer segundo.
`;
};

export const buildReelUserPrompt = (topic: string, tone: string) => {
  return `
Crea un guion detallado para un Reel sobre: "${topic}".
Tono: ${tone}

Genera el storyboard divido en escenas de 1-3 segundos como máximo.
Estructura JSON requerida:
{
  "title": "...",
  "scenes": [
    { "id": 1, "duration": "0-3s", "visual": "...", "audio": "..." }
  ]
}
`;
};
