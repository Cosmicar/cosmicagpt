
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowUpRight, CheckCircle2, Clock, MessageSquare, Play, Plus, Share2, Sparkles, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Link href="/generator">
            <Button className="bg-primary hover:bg-primary/80 text-white border-none shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <Sparkles className="mr-2 h-4 w-4" />
              Nueva Campaña
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Alcance Total</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">45,231</div>
            <p className="text-xs text-primary flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> +20.1% este mes
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Interacciones</CardTitle>
            <MessageSquare className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">12,405</div>
            <p className="text-xs text-secondary flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-1" /> +15% este mes
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Campañas Activas</CardTitle>
            <Activity className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">8</div>
            <p className="text-xs text-zinc-500 mt-1">
              3 requieren atención
            </p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Contenido Generado</CardTitle>
            <Share2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">142</div>
            <p className="text-xs text-zinc-500 mt-1">
              +5 desde ayer
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <CardTitle className="text-white">Rendimiento de Campañas</CardTitle>
            <CardDescription className="text-zinc-400">Métricas principales de los últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent className="pl-2 flex justify-center items-center h-[300px]">
            {/* Placeholder for chart */}
            <div className="relative w-full h-full flex items-end gap-2 px-6">
              {[40, 70, 45, 90, 65, 85, 120, 80, 110, 95].map((h, i) => (
                <div key={i} className="relative flex-1 bg-primary/20 rounded-t-md border-t border-primary/50 group hover:bg-primary/40 transition-all cursor-pointer" style={{ height: `${h}%` }}>
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-transparent to-primary/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-md"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <CardTitle className="text-white">Actividad Reciente</CardTitle>
            <CardDescription className="text-zinc-400">
              Últimas acciones en la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { title: "Campaña 'Lanzamiento SaaS' generada", time: "Hace 2 horas", icon: Sparkles, color: "text-primary", bg: "bg-primary/20" },
                { title: "Reel publicado en Instagram", time: "Hace 5 horas", icon: Play, color: "text-accent", bg: "bg-accent/20" },
                { title: "Nuevo prompt guardado en biblioteca", time: "Ayer a las 14:30", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/20" },
                { title: "Publicación programada para mañana", time: "Ayer a las 10:15", icon: Clock, color: "text-secondary", bg: "bg-secondary/20" },
              ].map((item, i) => (
                <div key={i} className="flex items-center">
                  <div className={`mr-4 p-2 rounded-full ${item.bg} border border-white/10`}>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className="ml-4 space-y-1">
                    <p className="text-sm font-medium leading-none text-white">{item.title}</p>
                    <p className="text-sm text-zinc-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
