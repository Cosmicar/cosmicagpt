"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Terminal, Activity, Zap, Play, Settings, ShieldCheck, Clock, Server, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { automationEngine } from "@/services/automation/automation-engine";
import { workflowEngine } from "@/services/workflows/workflow-engine";
import { AutomationLog, WorkflowState } from "@/types/automation";
import { cn } from "@/lib/utils";

export default function AutomationCenter() {
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    const data = await automationEngine.getLogs(20);
    setLogs(data);
    setActiveWorkflows(workflowEngine.getActiveWorkflows());
    setLoading(false);
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Automation Center</h2>
          <p className="text-zinc-400 mt-2">Centro de control y monitoreo de procesos autónomos.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold font-mono">
             <Server className="h-3 w-3" />
             CORE ONLINE
          </div>
          <Button variant="outline" size="sm" className="bg-black/40 border-white/10 text-white">
            <Settings className="h-4 w-4 mr-2" />
            Configurar Workers
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12 flex-1 overflow-hidden">
        {/* Left: Active Workflows & Pipelines */}
        <div className="md:col-span-4 space-y-6 overflow-y-auto custom-scrollbar">
           <Card className="glass-panel border-white/10 bg-black/40">
             <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Workflows Activos
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                {activeWorkflows.length === 0 ? (
                  <p className="text-xs text-zinc-600 italic text-center py-4">No hay procesos en ejecución.</p>
                ) : (
                  activeWorkflows.map(wf => (
                    <div key={wf.id} className="p-3 rounded-lg bg-white/5 border border-white/5 space-y-3">
                       <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-white">{wf.name}</span>
                          <RefreshCw className="h-3 w-3 text-primary animate-spin" />
                       </div>
                       <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${wf.progress}%` }}></div>
                       </div>
                       <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                          <span>{wf.current_task}</span>
                          <span>{wf.progress}%</span>
                       </div>
                    </div>
                  ))
                )}
             </CardContent>
           </Card>

           <Card className="glass-panel border-white/10 bg-black/40">
             <CardHeader><CardTitle className="text-white">System Health</CardTitle></CardHeader>
             <CardContent className="space-y-3">
                {[
                  { name: "IA Generator", status: "Optimal", color: "text-emerald-500" },
                  { name: "Visual Engine", status: "Optimal", color: "text-emerald-500" },
                  { name: "Supabase DB", status: "Optimal", color: "text-emerald-500" },
                  { name: "Meta Scheduler", status: "Standby", color: "text-blue-400" },
                ].map(s => (
                  <div key={s.name} className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">{s.name}</span>
                    <span className={cn("font-bold font-mono", s.color)}>{s.status}</span>
                  </div>
                ))}
             </CardContent>
           </Card>
        </div>

        {/* Right: Live Automation Logs */}
        <Card className="md:col-span-8 glass-panel border-white/10 bg-black/40 flex flex-col overflow-hidden">
          <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-secondary" />
                Live Automation Logs
              </CardTitle>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
               <Clock className="h-3 w-3" />
               STREAMING REAL-TIME
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
             <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[11px] custom-scrollbar bg-black/20">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-700">Esperando eventos de sistema...</div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 py-1.5 border-b border-white/5 group hover:bg-white/5 transition-colors">
                      <span className="text-zinc-600 shrink-0">[{new Date(log.created_at).toLocaleTimeString()}]</span>
                      <span className={cn("shrink-0 font-bold", 
                        log.status === "success" ? "text-emerald-500" : 
                        log.status === "error" ? "text-red-500" : "text-blue-400"
                      )}>
                        {log.status === "success" ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : <AlertCircle className="h-3 w-3 inline mr-1" />}
                        {log.event_type}
                      </span>
                      <span className="text-zinc-300">{log.message}</span>
                    </div>
                  ))
                )}
             </div>
             <div className="p-3 bg-black/40 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-zinc-500 font-mono">TOTAL LOGS: {logs.length}</span>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary hover:text-white">LIMPIAR CONSOLA</Button>
             </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
