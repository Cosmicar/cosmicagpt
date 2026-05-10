// WhatsApp Status Generator
// Genera textos cortos y directos optimizados para estados de WhatsApp.

export class StatusGenerator {
  generateWhatsAppStatus(campaign: { copy: string; hashtags?: string; cta?: string }) {
    // Extraer la primera línea o frase del copy para mantenerlo corto
    const firstLine = campaign.copy.split('\n')[0] || campaign.copy;
    
    // Limitar longitud
    const shortText = firstLine.length > 80 ? firstLine.substring(0, 77) + "..." : firstLine;
    
    const cta = campaign.cta || "📲 ¡Escríbenos para más info!";
    
    return `${shortText}\n\n${cta}`;
  }

  generateShortCTA(phone: string, text: string = "Más información") {
    return `📲 ${text}: wa.me/${phone.replace(/[^0-9]/g, '')}`;
  }

  generateWhatsAppCaption(campaign: { copy: string; hashtags?: string }) {
    return `${campaign.copy}\n\n${campaign.hashtags || ''}`;
  }
}

export const statusGenerator = new StatusGenerator();
