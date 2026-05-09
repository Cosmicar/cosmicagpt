import { EngagementInsight } from "@/types/analytics";

export class InsightsEngine {
  generateStrategicInsights(): EngagementInsight[] {
    return [
      {
        id: "1",
        type: "trend",
        message: "Tendencia alcista en contenido 'Space-Minimalist' en LinkedIn.",
        impact: "high",
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        type: "alert",
        message: "Fatiga detectada en formato 'Carrusel' los días lunes.",
        impact: "medium",
        created_at: new Date().toISOString(),
      },
      {
        id: "3",
        type: "suggestion",
        message: "Aumentar frecuencia de Reels con audio Phonk para mayor alcance.",
        impact: "high",
        created_at: new Date().toISOString(),
      }
    ];
  }
}

export const insightsEngine = new InsightsEngine();
