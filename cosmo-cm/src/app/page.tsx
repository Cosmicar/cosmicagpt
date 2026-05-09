"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, Clock, MessageSquare, Play, Plus, Share2, Sparkles, TrendingUp, Users, Loader2, Database, Zap, Video, ImageIcon, Calendar as CalendarIcon, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { campaignStorage } from "@/services/storage/campaign-storage";
import { scheduleService } from "@/services/scheduler/schedule-service";
import { CampaignRecord } from "@/types/campaign";
import { ScheduledPost } from "@/types/schedule";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [camps, posts] = await Promise.all([
        campaignStorage.getCampaigns(),
        scheduleService.getScheduledPosts()
      ]);
      setCampaigns(camps);
      setScheduledPosts(posts);
      setLoading(false);
    };
    fetchData();
  }, []);

  const todayPosts = scheduledPosts.filter(p => 
    new Date(p.scheduled_for).toDateString() === new Date().toDateString()
  );

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
            <CardTitle className="text-sm font-medium text-zinc-400">Hoy Programado</CardTitle>
            <Clock className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{loading ? "..." : todayPosts.length}</div>
            <p className="text-xs text-zinc-500 mt-1">Publicaciones para hoy</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Scheduler</CardTitle>
            <CalendarIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{loading ? "..." : scheduledPosts.length}</div>
            <p className="text-xs text-primary flex items-center mt-1">
               Próximos eventos
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">IA Assets</CardTitle>
            <Zap className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">24</div>
            <p className="text-xs text-zinc-500 mt-1">Reels & Flyers creados</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Estado Meta</CardTitle>
            <Database className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">READY</div>
            <p className="text-xs text-accent mt-1">API de Publicación OK</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Scheduler Widget */}
        <Card className="col-span-4 glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">Próximas Publicaciones</CardTitle>
              <CardDescription className="text-zinc-500">Timeline del scheduler inteligente</CardDescription>
            </div>
            <Link href="/calendar">
               <Button variant="ghost" size="sm" className="text-primary hover:text-white hover:bg-primary/10">
                 Ver Calendario
                 <ArrowUpRight className="ml-1 h-3 w-3" />
               </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : scheduledPosts.length === 0 ? (
              <p className="text-center text-zinc-600 py-8 text-sm italic">No hay publicaciones programadas.</p>
            ) : (
              scheduledPosts.slice(0, 4).map((post) => (
                <div key={post.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                   <div className="flex items-center gap-3">
                      <div className={cn("h-2 w-2 rounded-full", 
                        post.platform === "instagram" ? "bg-pink-500" : 
                        post.platform === "facebook" ? "bg-blue-500" : "bg-emerald-500"
                      )}></div>
                      <div>
                        <p className="text-sm font-medium text-white">{post.campaign_title}</p>
                        <p className="text-[10px] text-zinc-500 lowercase">
                          {post.platform} • {post.format} • {new Date(post.scheduled_for).toLocaleDateString()}
                        </p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-bold text-white">
                        {new Date(post.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[9px] text-primary uppercase font-bold tracking-tighter">
                        {post.status}
                      </p>
                   </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Campaign Widget */}
        <Card className="col-span-3 glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <CardTitle className="text-white">Campañas Recientes</CardTitle>
            <CardDescription className="text-zinc-400">Actividad de generación IA</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-6">
                {campaigns.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center">
                    <div className="mr-4 p-2 rounded-full bg-primary/10 border border-primary/20">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="ml-4 space-y-1">
                      <p className="text-sm font-medium text-white line-clamp-1">{item.title}</p>
                      <p className="text-[10px] text-zinc-500">{new Date(item.created_at).toLocaleDateString()}</p>
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
