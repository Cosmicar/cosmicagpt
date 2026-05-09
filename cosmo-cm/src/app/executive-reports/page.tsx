"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Download, Sparkles, Calendar, TrendingUp, PieChart, BarChart2, Plus, Loader2, Share2, Eye, CheckCircle2, ChevronRight, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reportEngine } from "@/services/reports/report-engine";
import { pdfGenerator } from "@/services/pdf/pdf-generator";
import { ExecutiveReport, ReportType } from "@/types/reports";
import { cn } from "@/lib/utils";

export default function ExecutiveReports() {
  const [reports, setReports] = useState<ExecutiveReport[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    const data = await reportEngine.getReportHistory();
    setReports(data);
    setLoading(false);
  };

  const handleGenerate = async (type: ReportType) => {
    setIsGenerating(true);
    const report = await reportEngine.generateReport(
      type, 
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 
      new Date()
    );
    if (report) fetchReports();
    setIsGenerating(false);
  };

  const handleDownload = async (report: ExecutiveReport) => {
    const url = await pdfGenerator.generatePDF(report);
    window.open(url, '_blank');
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Executive Reporting AI</h2>
          <p className="text-zinc-400 mt-2">Transformando datos estratégicos en informes de nivel ejecutivo.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            className="bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]"
            disabled={isGenerating}
            onClick={() => handleGenerate("monthly")}
          >
            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generar Reporte Mensual
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 flex-1 overflow-hidden">
        {/* Historial de Reportes */}
        <Card className="md:col-span-4 glass-panel border-white/10 bg-black/40 flex flex-col">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <HistoryIcon className="h-4 w-4 text-zinc-500" />
              Historial de Informes
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-0">
             {loading ? (
               <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
             ) : reports.length === 0 ? (
               <div className="p-8 text-center text-zinc-600 italic text-sm">No hay reportes generados.</div>
             ) : (
               <div className="divide-y divide-white/5">
                  {reports.map((report) => (
                    <div key={report.id} className="p-4 hover:bg-white/5 transition-colors cursor-pointer group">
                       <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="text-[9px] uppercase tracking-tighter bg-primary/10 border-primary/20 text-primary">
                             {report.report_type}
                          </Badge>
                          <span className="text-[10px] text-zinc-600 font-mono">
                             {new Date(report.created_at).toLocaleDateString()}
                          </span>
                       </div>
                       <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{report.summary.substring(0, 50)}...</h4>
                       <div className="flex items-center justify-between mt-3">
                          <span className="text-[10px] text-zinc-500">SCORE: {report.performance_score}%</span>
                          <div className="flex gap-1">
                             <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-white" onClick={() => handleDownload(report)}>
                                <Download className="h-3 w-3" />
                             </Button>
                             <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-primary">
                                <Eye className="h-3 w-3" />
                             </Button>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
             )}
          </CardContent>
        </Card>

        {/* Report Preview / Live Editor View */}
        <Card className="md:col-span-8 glass-panel border-white/10 bg-black/40 flex flex-col overflow-hidden relative">
           <div className="absolute top-0 right-0 p-8 opacity-5">
              <FileText className="h-64 w-64" />
           </div>
           {reports.length > 0 ? (
             <div className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="border-b border-white/5 bg-white/5 backdrop-blur-sm z-10">
                   <div className="flex justify-between items-center">
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 rounded bg-primary/20 border border-primary/40 flex items-center justify-center">
                            <BarChart2 className="h-6 w-6 text-primary" />
                         </div>
                         <div>
                            <CardTitle className="text-white uppercase tracking-widest text-sm">
                               {reports[0].report_type} REPORT // {new Date(reports[0].period_start).toLocaleDateString()} - {new Date(reports[0].period_end).toLocaleDateString()}
                            </CardTitle>
                            <CardDescription className="text-zinc-500 font-mono text-[10px]">CÓSMICA EXECUTIVE INTELLIGENCE UNIT</CardDescription>
                         </div>
                      </div>
                      <div className="flex items-center gap-2">
                         <Button variant="outline" size="sm" className="bg-black/40 border-white/10 text-white h-8 text-[10px] uppercase font-bold" onClick={() => handleDownload(reports[0])}>
                            <Download className="h-3 w-3 mr-2" /> PDF
                         </Button>
                         <Button variant="outline" size="sm" className="bg-black/40 border-white/10 text-white h-8 text-[10px] uppercase font-bold">
                            <Share2 className="h-3 w-3 mr-2" /> Compartir
                         </Button>
                      </div>
                   </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
                   {/* Executive Summary */}
                   <section className="space-y-4">
                      <h3 className="text-primary font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                         <div className="h-1 w-4 bg-primary"></div> Resumen Ejecutivo
                      </h3>
                      <p className="text-lg text-zinc-200 leading-relaxed font-light">
                         {reports[0].summary}
                      </p>
                   </section>

                   <div className="grid md:grid-cols-2 gap-8">
                      {/* Strategic Insights */}
                      <section className="space-y-4">
                         <h3 className="text-secondary font-bold uppercase tracking-widest text-xs">Conclusiones Clave</h3>
                         <div className="space-y-3">
                            {reports[0].insights.map((insight, i) => (
                              <div key={i} className="flex gap-3 p-3 rounded-lg bg-black/40 border border-white/5">
                                 <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                 <span className="text-sm text-zinc-300">{insight}</span>
                              </div>
                            ))}
                         </div>
                      </section>

                      {/* Performance Radar */}
                      <section className="space-y-4">
                         <h3 className="text-accent font-bold uppercase tracking-widest text-xs">Score de Período</h3>
                         <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 h-full">
                            <div className="relative h-32 w-32 flex items-center justify-center">
                               <div className="absolute inset-0 border-[8px] border-white/5 rounded-full"></div>
                               <div className="absolute inset-0 border-[8px] border-primary border-t-transparent rounded-full rotate-[120deg]"></div>
                               <span className="text-4xl font-black text-white">{reports[0].performance_score}%</span>
                            </div>
                            <p className="mt-4 text-[10px] text-zinc-500 font-mono">ESTADO: ÓPTIMO</p>
                         </div>
                      </section>
                   </div>

                   {/* AI Recommendations */}
                   <section className="p-6 rounded-xl bg-primary/5 border border-primary/20 space-y-4">
                      <h3 className="text-primary font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                         <Sparkles className="h-4 w-4" /> Recomendaciones IA
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                         {reports[0].recommendations.map((rec, i) => (
                           <div key={i} className="text-sm text-zinc-300 leading-relaxed">
                              • {rec}
                           </div>
                         ))}
                      </div>
                   </section>
                </CardContent>
             </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-30">
                <FileSpreadsheet className="h-24 w-24 mb-6" />
                <h3 className="text-2xl font-bold">Sin Reportes Activos</h3>
                <p className="mt-2">Inicia el motor de reporting para generar un análisis ejecutivo profundo.</p>
             </div>
           )}
        </Card>
      </div>
    </div>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  );
}
