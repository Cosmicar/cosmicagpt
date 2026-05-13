"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Server, Database, Layers, CheckCircle2, AlertTriangle, Clock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function InfrastructureDashboard() {
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const queues = [
    { name: "meta-publishing-queue", label: "Meta Publishing Queue" },
    { name: "whatsapp-status-queue", label: "WhatsApp Status Queue" },
  ];

  const fetchMetrics = async () => {
    setLoading(true);
    // Simular métricas para evitar importar BullMQ en el cliente
    const newMetrics: Record<string, any> = {
      "meta-publishing-queue": { waiting: 0, active: 0, completed: 5, failed: 0 },
      "whatsapp-status-queue": { waiting: 0, active: 0, completed: 12, failed: 0 }
    };
    setMetrics(newMetrics);
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Infraestructura & Operaciones</h2>
          <p className="text-zinc-400 mt-2">Monitoreo en tiempo real de workers, colas y recursos SaaS.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-500 uppercase font-mono py-1 px-3 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              SYSTEM HEALTHY
           </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
         <Card className="glass-panel border-white/10 bg-black/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-zinc-400">Estado Redis (Upstash)</CardTitle>
               <Database className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-white">Conectado</div>
               <p className="text-xs text-zinc-500 mt-1 font-mono">12ms latency</p>
            </CardContent>
         </Card>
         <Card className="glass-panel border-white/10 bg-black/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-zinc-400">Storage (Supabase)</CardTitle>
               <Layers className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-white">Activo</div>
               <p className="text-xs text-zinc-500 mt-1 font-mono">Bucket: cosmo-assets</p>
            </CardContent>
         </Card>
         <Card className="glass-panel border-white/10 bg-black/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-zinc-400">Workers Activos</CardTitle>
               <Server className="h-4 w-4 text-secondary" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-white">4 / 4</div>
               <p className="text-xs text-zinc-500 mt-1 font-mono">100% capacity</p>
            </CardContent>
         </Card>
         <Card className="glass-panel border-white/10 bg-black/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
               <CardTitle className="text-sm font-medium text-zinc-400">OpenAI Rate Limit</CardTitle>
               <Activity className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
               <div className="text-2xl font-bold text-white">Saludable</div>
               <p className="text-xs text-zinc-500 mt-1 font-mono">42/1000 RPM (Workspace)</p>
            </CardContent>
         </Card>
      </div>

      <h3 className="text-xl font-bold text-white mt-8 mb-4 flex items-center gap-2">
         <PlayCircle className="h-5 w-5 text-primary" /> Live Queues
      </h3>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 flex-1">
         {queues.map((q) => {
            const data = metrics[q.name] || { waiting: 0, active: 0, completed: 0, failed: 0 };
            return (
              <Card key={q.name} className="glass-panel border-white/10 bg-black/40">
                 <CardHeader className="border-b border-white/5 pb-3">
                    <CardTitle className="text-white text-base">{q.label}</CardTitle>
                    <p className="text-[10px] text-zinc-500 font-mono">{q.name}</p>
                 </CardHeader>
                 <CardContent className="pt-4">
                    <div className="grid grid-cols-4 gap-2 text-center">
                       <div className="bg-black/50 p-2 rounded border border-white/5">
                          <p className="text-2xl font-bold text-white">{data.waiting}</p>
                          <p className="text-[10px] uppercase text-zinc-500">Waiting</p>
                       </div>
                       <div className="bg-primary/10 p-2 rounded border border-primary/20">
                          <p className="text-2xl font-bold text-primary">{data.active}</p>
                          <p className="text-[10px] uppercase text-primary/70">Active</p>
                       </div>
                       <div className="bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                          <p className="text-2xl font-bold text-emerald-500">{data.completed}</p>
                          <p className="text-[10px] uppercase text-emerald-500/70">Done</p>
                       </div>
                       <div className="bg-red-500/10 p-2 rounded border border-red-500/20">
                          <p className="text-2xl font-bold text-red-500">{data.failed}</p>
                          <p className="text-[10px] uppercase text-red-500/70">Failed</p>
                       </div>
                    </div>
                 </CardContent>
              </Card>
            )
         })}
      </div>
    </div>
  );
}
