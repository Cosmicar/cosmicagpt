// WhatsApp Link Generator
// Genera links wa.me con mensajes precargados.

export class LinkGenerator {
  generateWhatsAppLink(phone: string, message: string): string {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  generatePreFilledMessage(campaignTitle: string): string {
    return `Hola, quiero más información sobre la campaña "${campaignTitle}".`;
  }
}

export const linkGenerator = new LinkGenerator();
