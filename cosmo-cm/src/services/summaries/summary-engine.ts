import { ReportSummary } from "@/types/reports";

export class SummaryEngine {
  generateExecutiveSummary(type: string): ReportSummary {
    return {
      executive_summary: `El rendimiento del período analizado muestra un crecimiento sólido del 15% en engagement global. La marca Cósmica mantiene una alta consistencia visual, aunque se detectan oportunidades de mejora en la retención de los Reels de más de 30 segundos.`,
      conclusions: [
        "Las campañas de branding superaron el KPI estimado en un 12%.",
        "Instagram sigue siendo la plataforma de mayor conversión para el segmento SaaS.",
        "El tono 'Energético' resuena mejor con la audiencia actual."
      ],
      opportunities: [
        "Escalar la frecuencia de flyers informativos en LinkedIn.",
        "Implementar hooks de tipo 'pregunta directa' para aumentar comentarios."
      ],
      alerts: [
        "Saturación detectada en la paleta de color secundaria los fines de semana."
      ]
    };
  }
}

export const summaryEngine = new SummaryEngine();
