"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Plus, Instagram, Facebook, Linkedin, Clock, Filter, List, Calendar as CalendarIcon, Trash2, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { scheduleService } from "@/services/scheduler/schedule-service";
import { ScheduledPost } from "@/types/schedule";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    const data = await scheduleService.getScheduledPosts();
    setScheduledPosts(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Cancelar esta programación?")) {
      const ok = await scheduleService.deleteSchedule(id);
      if (ok) fetchSchedules();
    }
  };

  const dayPosts = scheduledPosts.filter(post => 
    new Date(post.scheduled_for).toDateString() === date?.toDateString()
  );

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Scheduler Inteligente</h2>
          <p className="text-zinc-400 mt-2">Central de comando para la distribución de contenido IA.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setView(view === "calendar" ? "list" : "calendar")}
            className="bg-black/40 border-white/10 text-white"
          >
            {view === "calendar" ? <List className="h-4 w-4 mr-2" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
            {view === "calendar" ? "Ver Lista" : "Ver Calendario"}
          </Button>
          <Button className="bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Programación
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 flex-1">
        {/* Left Column: Selector */}
        <Card className="md:col-span-4 lg:col-span-3 glass-panel border-white/10 bg-black/40 h-fit">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" />
              Navegación
            </CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <CalendarUI
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border border-white/10 bg-black/50 text-white"
              classNames={{
                day_selected: "bg-primary text-primary-foreground hover:bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]",
                day_today: "bg-white/10 text-white",
              }}
            />
          </CardContent>
          <div className="p-4 border-t border-white/5 space-y-2">
             <p className="text-[10px] font-bold text-zinc-500 uppercase px-2 mb-2">Filtros</p>
             <div className="space-y-1">
                {["Instagram", "Facebook", "WhatsApp", "LinkedIn"].map(p => (
                  <div key={p} className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded transition-colors cursor-pointer group">
                    <div className={cn("h-2 w-2 rounded-full", 
                      p === "Instagram" ? "bg-pink-500" : 
                      p === "Facebook" ? "bg-blue-500" : 
                      p === "WhatsApp" ? "bg-emerald-500" : "bg-blue-800"
                    )}></div>
                    <span className="text-xs text-zinc-400 group-hover:text-white">{p}</span>
                  </div>
                ))}
             </div>
          </div>
        </Card>

        {/* Right Column: Timeline/List */}
        <Card className="md:col-span-8 lg:col-span-9 glass-panel border-white/10 bg-black/40 flex flex-col min-h-[500px]">
          <CardHeader className="border-b border-white/5 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl">
                Agenda: {date?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </CardTitle>
              <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary uppercase text-[10px] tracking-widest">
                {dayPosts.length} Eventos
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : dayPosts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <Clock className="h-16 w-16 mb-4" />
                <p>No hay publicaciones programadas para esta fecha.</p>
                <Button variant="link" className="text-primary mt-2">Programar una ahora</Button>
              </div>
            ) : (
              <div className="space-y-4">
                {dayPosts.map((post) => (
                  <div key={post.id} className={cn(
                    "flex items-start p-4 rounded-lg border backdrop-blur-sm transition-all group relative overflow-hidden",
                    scheduleService.getPlatformColor(post.platform)
                  )}>
                    {/* Status Indicator */}
                    <div className="absolute top-0 right-0 px-2 py-1 bg-white/10 text-[9px] font-bold uppercase">
                      {post.status}
                    </div>

                    <div className="flex flex-col items-center justify-center mr-6 px-4 border-r border-current/20 min-w-[80px]">
                      <span className="text-lg font-bold">
                        {new Date(post.scheduled_for).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex-1 space-y-1">
                      <h4 className="text-lg font-semibold text-white group-hover:glow-text-primary transition-all">
                        {post.campaign_title}
                      </h4>
                      <div className="flex items-center gap-3 text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1 uppercase font-bold text-zinc-500">
                          <LayersIcon platform={post.platform} />
                          {post.platform} • {post.format}
                        </span>
                        {post.notes && <span className="italic">"{post.notes}"</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                       <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-zinc-500 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(post.id)}
                       >
                         <Trash2 className="h-4 w-4" />
                       </Button>
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

function LayersIcon({ platform }: { platform: string }) {
  if (platform.toLowerCase() === 'instagram') return <Instagram className="h-3 w-3" />;
  if (platform.toLowerCase() === 'facebook') return <Facebook className="h-3 w-3" />;
  if (platform.toLowerCase() === 'whatsapp') return <MessageSquare className="h-3 w-3" />;
  return <Linkedin className="h-3 w-3" />;
}
