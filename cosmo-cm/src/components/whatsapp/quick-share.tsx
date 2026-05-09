"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, ExternalLink, MessageSquare, Check, Share2 } from "lucide-react";
import { statusGenerator } from "@/services/whatsapp/status-generator";
import { linkGenerator } from "@/services/whatsapp/link-generator";

interface QuickShareProps {
  campaign: {
    title: string;
    copy: string;
    hashtags?: string;
    cta?: string;
  };
  phone?: string;
}

export function QuickShare({ campaign, phone = "543883298736" }: QuickShareProps) {
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const statusText = statusGenerator.generateWhatsAppStatus(campaign);
  const preFilledMessage = linkGenerator.generatePreFilledMessage(campaign.title);
  const waLink = linkGenerator.generateWhatsAppLink(phone, preFilledMessage);

  const handleCopyText = () => {
    navigator.clipboard.writeText(statusText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(waLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    window.open(waLink, '_blank');
  };

  return (
    <Card className="glass-panel border-white/10 bg-black/40">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-emerald-500" />
          <CardTitle className="text-white text-base">Compartir en WhatsApp</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-zinc-900/50 border border-white/5 rounded-lg">
          <p className="text-xs text-zinc-500 mb-1">Texto para Estado:</p>
          <p className="text-sm text-white whitespace-pre-wrap">{statusText}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5 text-white text-xs" onClick={handleCopyText}>
            {copiedText ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            Copiar Texto
          </Button>
          <Button variant="outline" size="sm" className="border-white/10 hover:bg-white/5 text-white text-xs" onClick={handleCopyLink}>
            {copiedLink ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5 mr-1" />}
            Copiar Link
          </Button>
        </div>

        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm" onClick={handleOpenWhatsApp}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Abrir en WhatsApp
        </Button>
      </CardContent>
    </Card>
  );
}
