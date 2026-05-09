"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, BarChart, TrendingUp, TrendingDown, Target, Zap, Clock, Share2, Lightbulb, AlertTriangle, Loader2, Gauge, Radar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { insightsEngine } from "@/services/insights/insights-engine";
import { scoringEngine } from "@/services/scoring/scoring-engine";
import { EngagementInsight, StrategicScore } from "@/types/analytics";
import { cn } from "@/lib/utils";

export default function AnalyticsIntelligence() {
  const [insights, setInsights] = useState<EngagementInsight[]>([]);
  const [scores, setScores] = useState<StrategicScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data fetch
    setTimeout(() => {
      setInsights(insightsEngine.generateStrategicInsights());
      setScores(scoringEngine.calculateStrategicScore({}));
      setLoading(false);
    }, 1500);
  }, []);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Analytics Intelligence</h2>
          <p className="text-zinc-400 mt-2">IA estratégica anticipando el comportamiento y optimizando el ROI.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold font-mono">
           <Gauge className="h-3 w-3" />
           PREDICTIVE ENGINE: CALIBRATED
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 flex-1">
        {/* Left Column: Metrics & Radar */}
        <div className="md:col-span-4 space-y-6">
           <Card className="glass-panel border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="text-white text-sm">Ecosystem Strategic Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 {scores && (
                   <div className="space-y-3">
                      {Object.entries(scores).map(([key, val]) => (
                        <div key={key} className="space-y-1">
                           <div className="flex justify-between text-[10px] font-mono uppercase text-zinc-500">
                              <span>{key}</span>
                              <span className="text-primary">{val}%</span>
                           </div>
                           <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000" style={{ width: `${val}%` }}></div>
                           </div>
                        </div>
                      ))}
                   </div>
                 )}
              </CardContent>
           </Card>

           <Card className="glass-panel border-white/10 bg-black/40">
              <CardHeader><CardTitle className="text-white text-sm">Engagement Forecast</CardTitle></CardHeader>
              <CardContent className="h-[150px] flex items-end gap-1 px-4">
                 {[40, 60, 55, 80, 75, 90, 85, 110, 100, 130].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-primary/20 to-primary/50 rounded-t border-t border-primary/40" style={{ height: `${h / 1.5}%` }}></div>
                 ))}
              </CardContent>
              <div className="p-3 text-center text-[10px] text-zinc-500 font-mono border-t border-white/5">
                 TENDENCIA ALCISTA ESTIMADA // +12.4% PROX. SEMANA
              </div>
           </Card>
        </div>

        {/* Center/Right: Insights & Heatmaps */}
        <div className="md:col-span-8 space-y-6 overflow-y-auto custom-scrollbar pr-2">
           <div className="grid md:grid-cols-2 gap-6">
              <Card className="glass-panel border-white/10 bg-black/40">
                 <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                       <Clock className="h-4 w-4 text-secondary" />
                       Best Time AI
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="grid grid-cols-7 gap-1 h-[100px]">
                       {Array.from({ length: 28 }).map((_, i) => (
                         <div key={i} className={cn("rounded-sm border border-white/5 transition-colors", 
                            i % 5 === 0 ? "bg-secondary/40" : i % 3 === 0 ? "bg-secondary/20" : "bg-white/5"
                         )}></div>
                       ))}
                    </div>
                    <p className="mt-4 text-[10px] text-zinc-400 text-center font-mono uppercase">
                       Lunes a Jueves: 18:30 - 21:00 (Ventana de alta atención)
                    </p>
                 </CardContent>
              </Card>

              <Card className="glass-panel border-white/10 bg-black/40">
                 <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                       <Zap className="h-4 w-4 text-emerald-400" />
                       Viral Potential Detection
                    </CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-xs text-zinc-400 font-mono uppercase">Current Peak:</span>
                       <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">92% MATCH</Badge>
                    </div>
                    <div className="p-3 rounded bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-200 italic">
                       "Estructura detectada: 'Problema Inmediato + Solución Disruptiva' está performando un 40% mejor que la media."
                    </div>
                 </CardContent>
              </Card>
           </div>

           <Card className="glass-panel border-white/10 bg-black/40">
              <CardHeader>
                 <CardTitle className="text-white flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-primary" />
                    AI Strategic Suggestions
                 </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                 {loading ? (
                   <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
                 ) : (
                   insights.map(insight => (
                     <div key={insight.id} className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 group hover:border-primary/30 transition-all">
                        <div className={cn("p-2 rounded-full", 
                           insight.type === "alert" ? "bg-red-500/10 text-red-500" : 
                           insight.type === "trend" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-500"
                        )}>
                           {insight.type === "alert" ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 space-y-1">
                           <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold uppercase text-zinc-500 font-mono">{insight.type}</span>
                              <Badge variant="outline" className={cn("text-[9px]", 
                                 insight.impact === "high" ? "text-red-400 border-red-400/30" : "text-zinc-500 border-zinc-500/30"
                              )}>IMPACT: {insight.impact}</Badge>
                           </div>
                           <p className="text-sm text-zinc-200">{insight.message}</p>
                        </div>
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
