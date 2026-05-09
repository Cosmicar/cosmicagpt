"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Star, TrendingUp, History, Network, Sparkles, Database, Zap, ArrowUpRight, BarChart3, Fingerprint } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { memoryEngine } from "@/services/memory/memory-engine";
import { knowledgeEngine } from "@/services/knowledge/knowledge-engine";
import { CampaignMemory, ViralStructure } from "@/types/memory";

export default function AIMemory() {
  const [topMemories, setTopMemories] = useState<any[]>([]);
  const [viralHooks, setViralHooks] = useState<ViralStructure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [memories, hooks] = await Promise.all([
        memoryEngine.getTopPerformingCampaigns(3),
        knowledgeEngine.getViralHooks("instagram")
      ]);
      setTopMemories(memories);
      setViralHooks(hooks);
      setLoading(false);
    }
    fetchData();
  }, []);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">AI Memory Center</h2>
          <p className="text-zinc-400 mt-2">Memoria contextual y evolución del conocimiento Cósmica.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary animate-pulse">
           <Network className="h-4 w-4" />
           <span className="text-xs font-bold font-mono">NEURAL NETWORK ACTIVE</span>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 flex-1">
        {/* Memory Grid */}
        <div className="md:col-span-8 space-y-6 overflow-y-auto custom-scrollbar pr-2">
           <Card className="glass-panel border-white/10 bg-black/40 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Brain className="h-24 w-24" />
              </div>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Star className="h-4 w-4 text-secondary" />
                  Estructuras de Mayor Éxito
                </CardTitle>
                <CardDescription>Campañas históricas que definen el estilo de la marca</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 {topMemories.length === 0 ? (
                   <div className="py-8 text-center text-zinc-600 italic text-sm">Esperando datos de performance históricos...</div>
                 ) : (
                   topMemories.map((m, i) => (
                     <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all group">
                        <div className="flex justify-between items-start mb-2">
                           <h4 className="text-white font-bold">{m.campaigns?.title || "Campaña de Referencia"}</h4>
                           <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">SCORE: {m.performance_score}</Badge>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 mb-4">{m.notes || "Estructura optimizada para conversión de alta retención."}</p>
                        <div className="grid grid-cols-4 gap-2">
                           {["Viral", "Engagement", "Ventas", "Branding"].map((tag, j) => (
                             <div key={j} className="text-[9px] text-zinc-500 uppercase font-mono border border-white/5 rounded px-2 py-1 bg-black/40">{tag}</div>
                           ))}
                        </div>
                     </div>
                   ))
                 )}
              </CardContent>
           </Card>

           <div className="grid md:grid-cols-2 gap-6">
              <Card className="glass-panel border-white/10 bg-black/40">
                <CardHeader>
                   <CardTitle className="text-white text-sm flex items-center gap-2">
                     <TrendingUp className="h-4 w-4 text-primary" />
                     Patrones Detectados
                   </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                   {[
                     { name: "Hook Interrogativo", usage: 45, success: "88%" },
                     { name: "CTA Urgencia", usage: 32, success: "72%" },
                     { name: "Storytelling Tech", usage: 56, success: "94%" },
                   ].map(p => (
                     <div key={p.name} className="flex justify-between items-center text-xs">
                        <span className="text-zinc-400">{p.name}</span>
                        <div className="flex items-center gap-3">
                           <span className="text-[10px] text-zinc-600">x{p.usage}</span>
                           <span className="font-bold text-primary font-mono">{p.success}</span>
                        </div>
                     </div>
                   ))}
                </CardContent>
              </Card>

              <Card className="glass-panel border-white/10 bg-black/40">
                <CardHeader>
                   <CardTitle className="text-white text-sm flex items-center gap-2">
                     <Zap className="h-4 w-4 text-accent" />
                     Evolución del Aprendizaje
                   </CardTitle>
                </CardHeader>
                <CardContent className="h-[100px] flex items-end gap-1 px-4 pb-2">
                   {[20, 35, 25, 45, 60, 55, 80, 75, 95, 100].map((h, i) => (
                     <div key={i} className="flex-1 bg-primary/20 rounded-t border-t border-primary/40" style={{ height: `${h}%` }}></div>
                   ))}
                </CardContent>
              </Card>
           </div>
        </div>

        {/* Knowledge Right Column */}
        <div className="md:col-span-4 space-y-6">
           <Card className="glass-panel border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Fingerprint className="h-4 w-4 text-emerald-400" />
                  Identidad Cósmica
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="p-3 rounded bg-black/40 border border-white/5 text-[11px] text-zinc-400 leading-relaxed italic">
                    "Tono enérgico, minimalista y profundamente tecnológico. Evitar tecnicismos vacíos; priorizar la eficiencia tangible."
                 </div>
                 <div className="space-y-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Reglas Contextuales</p>
                    <ul className="text-[11px] text-zinc-300 space-y-2">
                       <li className="flex items-start gap-2"><Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" /> Uso de metáforas espaciales.</li>
                       <li className="flex items-start gap-2"><Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" /> Enfoque en 'Escalabilidad IA'.</li>
                       <li className="flex items-start gap-2"><Sparkles className="h-3 w-3 text-primary mt-0.5 shrink-0" /> Terminología de Vanguardia.</li>
                    </ul>
                 </div>
              </CardContent>
           </Card>

           <Card className="glass-panel border-white/10 bg-black/40">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2 text-sm">
                   <History className="h-4 w-4 text-zinc-500" />
                   Hooks Virales Históricos
                 </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                 {viralHooks.length === 0 ? (
                   <p className="text-[10px] text-zinc-600 text-center py-2">No hay hooks indexados aún.</p>
                 ) : (
                   viralHooks.map((h, i) => (
                     <div key={i} className="p-2 rounded bg-black/60 border border-white/5 text-[11px] text-zinc-300 relative group">
                        "{h.hook}"
                        <ArrowUpRight className="absolute right-1 top-1 h-3 w-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                     </div>
                   ))
                 )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
