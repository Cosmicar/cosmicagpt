"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Plus, Instagram, Facebook, Linkedin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const scheduledEvents = [
  { id: 1, title: "Reel Lanzamiento", time: "10:00 AM", platform: "instagram", date: new Date(), color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
  { id: 2, title: "Post Educativo SaaS", time: "14:30 PM", platform: "linkedin", date: new Date(), color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { id: 3, title: "Flyer Promoción", time: "18:00 PM", platform: "facebook", date: new Date(), color: "bg-blue-600/20 text-blue-500 border-blue-600/30" },
];

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Calendario</h2>
          <p className="text-zinc-400 mt-2">Planifica y organiza tus publicaciones generadas por IA.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          <Plus className="mr-2 h-4 w-4" />
          Programar Post
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-12 flex-1">
        <Card className="md:col-span-4 lg:col-span-3 glass-panel border-white/10 bg-black/40 flex flex-col h-fit">
          <CardHeader>
            <CardTitle className="text-white text-lg">Navegador</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <CalendarUI
              mode="single"
              selected={date}
              onSelect={setDate}
              className="rounded-md border border-white/10 bg-black/50 text-white"
              classNames={{
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-[0_0_10px_rgba(59,130,246,0.5)]",
                day_today: "bg-white/10 text-white",
              }}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-8 lg:col-span-9 glass-panel border-white/10 bg-black/40 flex flex-col min-h-[500px]">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-xl">
                Agenda del {date?.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-black border-white/10 text-zinc-400">Hoy</Badge>
                <Badge variant="outline" className="bg-primary/20 border-primary/30 text-primary">Próximos</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-6">
            <div className="space-y-4">
              {scheduledEvents.map((event) => (
                <div key={event.id} className={`flex items-start p-4 rounded-lg border bg-black/40 backdrop-blur-sm transition-all hover:bg-black/60 ${event.color}`}>
                  <div className="flex flex-col items-center justify-center mr-6 px-4 border-r border-current/20">
                    <span className="text-lg font-bold">{event.time.split(' ')[0]}</span>
                    <span className="text-xs uppercase">{event.time.split(' ')[1]}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-white mb-1">{event.title}</h4>
                    <div className="flex items-center text-sm text-zinc-400">
                      <Clock className="h-3 w-3 mr-1" /> Programado
                    </div>
                  </div>
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-white/5 border border-white/10">
                    {event.platform === 'instagram' && <Instagram className="h-5 w-5 text-pink-400" />}
                    {event.platform === 'linkedin' && <Linkedin className="h-5 w-5 text-blue-400" />}
                    {event.platform === 'facebook' && <Facebook className="h-5 w-5 text-blue-500" />}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-center p-8 rounded-lg border border-dashed border-white/20 bg-black/20">
                <p className="text-zinc-500 text-sm">Fin de las publicaciones programadas para este día.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
