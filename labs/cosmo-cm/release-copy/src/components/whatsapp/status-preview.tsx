"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { statusGenerator } from "@/services/whatsapp/status-generator";

interface StatusPreviewProps {
  campaign: {
    copy: string;
    hashtags?: string;
    cta?: string;
  };
}

export function StatusPreview({ campaign }: StatusPreviewProps) {
  const statusText = statusGenerator.generateWhatsAppStatus(campaign);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <p className="text-xs text-zinc-500 mb-2 self-start">Vista Previa de Estado:</p>
      
      {/* Mobile Frame Simulation */}
      <div className="w-[280px] h-[500px] bg-gradient-to-br from-emerald-600 to-teal-800 rounded-[30px] border-[8px] border-zinc-800 shadow-2xl relative overflow-hidden flex flex-col justify-between p-6">
        {/* Notch */}
        <div className="w-24 h-4 bg-zinc-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-xl"></div>
        
        {/* Status Content (Centered) */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <p className="text-white text-lg font-medium whitespace-pre-wrap leading-relaxed">
            {statusText}
          </p>
        </div>

        {/* Footer/CTA Area */}
        <div className="w-full bg-black/20 backdrop-blur-sm p-3 rounded-xl flex items-center justify-between">
          <span className="text-white/80 text-xs">Responder</span>
          <MessageSquare className="h-4 w-4 text-white/80" />
        </div>
      </div>
    </div>
  );
}
