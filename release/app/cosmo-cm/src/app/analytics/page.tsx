import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, BarChart3, LineChart, PieChart } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Analytics</h2>
        <p className="text-zinc-400 mt-2">Métricas avanzadas y rendimiento de campañas.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-white/20 bg-black/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5"></div>
        
        <div className="relative z-10 flex flex-col items-center max-w-lg mx-auto">
          <div className="flex gap-4 mb-8">
            <div className="h-16 w-16 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <BarChart3 className="h-8 w-8 text-primary" />
            </div>
            <div className="h-16 w-16 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(255,107,0,0.2)] mt-4">
              <LineChart className="h-8 w-8 text-secondary" />
            </div>
            <div className="h-16 w-16 rounded-2xl bg-black/50 border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.2)]">
              <PieChart className="h-8 w-8 text-accent" />
            </div>
          </div>
          
          <h3 className="text-2xl font-bold text-white mb-4">Módulo en Desarrollo</h3>
          <p className="text-zinc-400 mb-8 leading-relaxed">
            Estamos integrando métricas avanzadas en tiempo real. Pronto podrás visualizar el impacto exacto de cada campaña generada por IA, comparar rendimientos entre plataformas y exportar reportes detallados.
          </p>
          
          <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Activity className="mr-2 h-4 w-4 animate-pulse" />
            Próximamente
          </div>
        </div>
      </div>
    </div>
  );
}
