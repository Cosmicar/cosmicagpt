"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, Clock, MessageSquare, Play, Plus, Share2, Sparkles, TrendingUp, Users, Loader2, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { campaignStorage } from "@/services/storage/campaign-storage";
import { CampaignRecord } from "@/types/campaign";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecent = async () => {
      const data = await campaignStorage.getCampaigns();
      setCampaigns(data.slice(0, 5));
      setLoading(false);
    };
    fetchRecent();
  }, []);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Centro de Operaciones</h2>
        <div className="flex items-center space-x-2">
          <Link href="/generator">
            <Button className="bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]">
              <Sparkles className="mr-2 h-4 w-4" />
              Nueva Campaña IA
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Campañas</CardTitle>
            <Database className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{loading ? "..." : campaigns.length}</div>
            <p className="text-xs text-zinc-500 mt-1">Sincronizado con Supabase</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Alcance Mock</CardTitle>
            <Users className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">45.2k</div>
            <p className="text-xs text-secondary flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> +20%
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Engagement</CardTitle>
            <Activity className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12.4%</div>
            <p className="text-xs text-zinc-500 mt-1">Promedio global</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Status IA</CardTitle>
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">ONLINE</div>
            <p className="text-xs text-emerald-500 mt-1">Motor Cósmica Activo</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass-panel border-white/10 bg-black/40">
          <CardHeader><CardTitle className="text-white">Análisis de Impacto</CardTitle></CardHeader>
          <CardContent className="h-[300px] flex items-end gap-2 px-6">
            {[40, 70, 45, 90, 65, 85, 120, 80, 110, 95].map((h, i) => (
              <div key={i} className="flex-1 bg-primary/20 rounded-t-md border-t border-primary/50" style={{ height: `${h}%` }} />
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-3 glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <CardTitle className="text-white">Campañas Recientes</CardTitle>
            <CardDescription className="text-zinc-400">Persistencia real desde la nube</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : campaigns.length === 0 ? (
              <p className="text-center text-zinc-600 py-8 text-sm italic">No hay actividad registrada.</p>
            ) : (
              <div className="space-y-6">
                {campaigns.map((item) => (
                  <div key={item.id} className="flex items-center">
                    <div className="mr-4 p-2 rounded-full bg-primary/10 border border-primary/20">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium text-white line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-zinc-500">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    <div className="ml-auto text-[10px] font-bold text-zinc-600 uppercase border border-zinc-800 px-2 py-0.5 rounded">
                      {item.platform}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
