"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Image as ImageIcon, MessageSquare, Sparkles, Loader2, Play, Copy, Music, Layers, Zap } from "lucide-react";
import { campaignStorage } from "@/services/storage/campaign-storage";
import { CampaignRecord } from "@/types/campaign";
import { ReelStructure, FlyerStructure, WhatsAppStatusStructure } from "@/types/visual";
import { reelGenerator } from "@/services/reels/reel-generator";
import { flyerGenerator } from "@/services/flyers/flyer-generator";
import { whatsappStatusGenerator } from "@/services/storyboards/whatsapp-generator";

export default function VisualEngine() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [format, setFormat] = useState<string>("reel");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reelResult, setReelResult] = useState<ReelStructure | null>(null);
  const [flyerResult, setFlyerResult] = useState<FlyerStructure | null>(null);
  const [waResult, setWaResult] = useState<WhatsAppStatusStructure | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const data = await campaignStorage.getCampaigns();
      setCampaigns(data);
    };
    fetchCampaigns();
  }, []);

  const handleGenerate = () => {
    const campaign = campaigns.find(c => c.id === selectedId);
    if (!campaign) return;

    setIsGenerating(true);
    setReelResult(null);
    setFlyerResult(null);
    setWaResult(null);

    // Simulate generation time
    setTimeout(() => {
      if (format === "reel") setReelResult(reelGenerator.generateReel(campaign));
      if (format === "flyer") setFlyerResult(flyerGenerator.generateFlyer(campaign));
      if (format === "whatsapp") setWaResult(whatsappStatusGenerator.generateStatus(campaign));
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Visual Content Engine</h2>
        <p className="text-zinc-400 mt-2">Transforma tus campañas estratégicas en activos visuales de alto impacto.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-12 flex-1 min-h-0">
        {/* Selector Panel */}
        <Card className="md:col-span-4 glass-panel border-white/10 bg-black/40 h-fit">
          <CardHeader>
            <CardTitle className="text-white">Configuración Visual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Seleccionar Campaña</label>
              <Select onValueChange={setSelectedId} value={selectedId}>
                <SelectTrigger className="bg-black/50 border-white/10 text-white">
                  <SelectValue placeholder="Elige una campaña..." />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white">
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Formato de Salida</label>
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={format === "reel" ? "default" : "outline"} 
                  onClick={() => setFormat("reel")}
                  className={format === "reel" ? "bg-primary" : "bg-black/40 border-white/10"}
                >
                  <Video className="h-4 w-4" />
                </Button>
                <Button 
                  variant={format === "flyer" ? "default" : "outline"} 
                  onClick={() => setFormat("flyer")}
                  className={format === "flyer" ? "bg-primary" : "bg-black/40 border-white/10"}
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button 
                  variant={format === "whatsapp" ? "default" : "outline"} 
                  onClick={() => setFormat("whatsapp")}
                  className={format === "whatsapp" ? "bg-primary" : "bg-black/40 border-white/10"}
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Button 
              className="w-full bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)] mt-2"
              onClick={handleGenerate}
              disabled={!selectedId || isGenerating}
            >
              {isGenerating ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Procesar Activo Visual
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card className="md:col-span-8 glass-panel border-white/10 bg-black/40 h-full flex flex-col overflow-hidden">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Resultado Visual Engine
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-6">
            {!reelResult && !flyerResult && !waResult && !isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                <Music className="h-16 w-16 mb-4" />
                <p>Configura y procesa para ver el desglose visual cinematográfico.</p>
              </div>
            )}

            {isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="h-20 w-20 relative mb-6">
                  <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin"></div>
                  <Layers className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Renderizando Concepto...</h3>
                <p className="text-zinc-500 font-mono text-xs">CALCULATING DEPTH OF FIELD // OPTIMIZING NEON BLOOM</p>
              </div>
            )}

            {/* Reel Result View */}
            {reelResult && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white">Estructura de Reel</h3>
                    <p className="text-xs text-primary font-mono">ENERGÍA: {reelResult.visualEnergy}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-md border border-white/10">
                    <Music className="h-4 w-4 text-accent" />
                    <span className="text-[10px] text-zinc-300 font-medium">{reelResult.musicSuggestion}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  {reelResult.scenes.map((scene, i) => (
                    <div key={scene.id} className="relative p-4 rounded-lg bg-black/40 border border-white/5 hover:border-primary/30 transition-all group">
                      <div className="absolute -left-2 top-4 h-6 w-1 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Escena {scene.id} // {scene.duration}</span>
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded uppercase">{scene.transition}</span>
                      </div>
                      <h4 className="text-white font-bold mb-2">{scene.textOverlay}</h4>
                      <p className="text-sm text-zinc-300 mb-3 leading-relaxed">{scene.visual}</p>
                      <div className="text-[10px] text-zinc-500 italic bg-black/40 p-2 rounded border border-dashed border-white/10">
                        AUDIO: {scene.audio}
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                        <span className="text-[9px] font-bold text-primary uppercase">Prompt Cinematográfico IA:</span>
                        <div className="p-2 rounded bg-black/60 text-[9px] text-zinc-500 font-mono relative group/prompt">
                          {reelResult.cinematicPrompts[i].mj_prompt}
                          <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-5 w-5 opacity-0 group-hover/prompt:opacity-100 transition-opacity" onClick={() => navigator.clipboard.writeText(reelResult.cinematicPrompts[i].mj_prompt)}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flyer Result View */}
            {flyerResult && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="border-l-4 border-primary pl-4">
                  <h3 className="text-2xl font-bold text-white">Concepto de Flyer</h3>
                  <p className="text-zinc-500 text-xs">ESTILO: {flyerResult.graphicStyle}</p>
                </div>

                <div className="grid gap-4">
                  <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                    <span className="text-[10px] font-bold text-secondary uppercase block mb-2">Headline Visual</span>
                    <p className="text-xl font-bold text-white">{flyerResult.headline}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                      <span className="text-[10px] font-bold text-primary uppercase block mb-2">Estructura de Bloques</span>
                      <div className="space-y-1">
                        {flyerResult.blockStructure.map((b, i) => (
                          <div key={i} className="text-[11px] text-zinc-300">• {b}</div>
                        ))}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-black/40 border border-white/5">
                      <span className="text-[10px] font-bold text-accent uppercase block mb-2">Paleta de Colores</span>
                      <div className="flex gap-2">
                        {flyerResult.colorPalette.map((c, i) => (
                          <div key={i} className="h-8 w-8 rounded-full border border-white/10" style={{ backgroundColor: c }}></div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-black/80 border border-dashed border-primary/30">
                    <span className="text-[10px] font-bold text-primary uppercase block mb-2">Master Prompt Visual IA</span>
                    <p className="text-[10px] text-zinc-400 italic font-mono">{flyerResult.visualPrompt}</p>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp Status Result View */}
            {waResult && (
              <div className="h-full flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="w-[300px] h-[533px] bg-gradient-to-b from-zinc-900 to-black rounded-3xl border-[8px] border-zinc-800 relative overflow-hidden shadow-2xl shadow-primary/20">
                   <div className="absolute inset-0 opacity-20 pointer-events-none">
                      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#3B82F6_0%,transparent_70%)]"></div>
                   </div>
                   <div className="relative h-full p-8 flex flex-col justify-center items-center text-center">
                      <div className="text-zinc-500 text-[10px] font-mono mb-8 opacity-50">CÓSMICA VISUAL ENGINE // MOBILE STATUS</div>
                      <h4 className="text-white font-black text-4xl leading-tight tracking-tighter whitespace-pre-line drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                        {waResult.giantText}
                      </h4>
                      <div className="mt-12 p-3 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/50">
                        {waResult.quickCta}
                      </div>
                   </div>
                   <div className="absolute bottom-6 w-full px-6 flex justify-between items-center">
                      <div className="h-1 w-20 bg-white/20 rounded-full"></div>
                      <div className="h-1 w-20 bg-white/20 rounded-full"></div>
                   </div>
                </div>
                <p className="text-zinc-500 text-xs font-mono">VISTA PREVIA DEL ESTADO VERTICAL</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
