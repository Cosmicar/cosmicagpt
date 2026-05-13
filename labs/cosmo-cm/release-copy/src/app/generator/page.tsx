"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Copy, CheckCircle2, MessageCircle, Terminal, Info, Database } from "lucide-react";
import { campaignGenerator } from "@/services/generators/campaign-generator";
import { campaignStorage } from "@/services/storage/campaign-storage";
import { CampaignInput, CampaignOutput, Platform, Format, Tone, Objective } from "@/types/campaign";

export default function Generator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<CampaignOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const addLog = (msg: string) => {
    setSystemLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-5));
  };

  const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);
    setSystemLogs([]);
    setSaveSuccess(false);
    
    const formData = new FormData(e.currentTarget);
    const input: CampaignInput = {
      servicio: formData.get("servicio") as string,
      objetivo: formData.get("objetivo") as Objective,
      plataforma: formData.get("plataforma") as Platform,
      formato: formData.get("formato") as Format,
      tono: formData.get("tono") as Tone,
      promocion: formData.get("promocion") as string,
      contexto: formData.get("contexto") as string,
    };

    addLog("Iniciando motor Cósmica AI...");

    try {
      addLog("Analizando parámetros y optimizando prompts...");
      const campaign = await campaignGenerator.generate(input);
      setResult(campaign);
      addLog("Generación exitosa. Iniciando persistencia...");

      setIsSaving(true);
      const saved = await campaignStorage.saveCampaign(input, campaign);
      
      if (saved) {
        addLog("Campaña sincronizada con Supabase Core.");
        setSaveSuccess(true);
      } else {
        addLog("ADVERTENCIA: Fallo al guardar en la nube (Modo local)");
      }
    } catch (err: any) {
      setError(err.message);
      addLog("ERROR: Fallo en la secuencia crítica.");
    } finally {
      setIsGenerating(false);
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Generador de Campañas</h2>
          <p className="text-zinc-400 mt-2">IA estratégica conectada a Supabase Core.</p>
        </div>
        <div className="flex gap-2">
          {saveSuccess && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-mono animate-in fade-in zoom-in">
              <Database className="h-3 w-3" />
              SINCRONIZADO
            </div>
          )}
          {result?.mocked && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-mono">
              <Info className="h-3 w-3" />
              MODO MOCK
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 flex-1 min-h-0">
        <Card className="glass-panel border-white/10 bg-black/40 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-white">Parámetros de Entrada</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="servicio" className="text-zinc-300">Servicio/Producto</Label>
                <Input name="servicio" id="servicio" placeholder="Ej: SaaS de Logística" className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Objetivo</Label>
                  <Select name="objetivo" defaultValue="leads" required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="ventas">Ventas</SelectItem>
                      <SelectItem value="leads">Leads</SelectItem>
                      <SelectItem value="branding">Branding</SelectItem>
                      <SelectItem value="educacion">Educativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Plataforma</Label>
                  <Select name="plataforma" defaultValue="instagram" required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Formato</Label>
                  <Select name="formato" defaultValue="reel" required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="reel">Reel</SelectItem>
                      <SelectItem value="post">Flyer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Tono</Label>
                  <Select name="tono" defaultValue="tecnologico" required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="tecnologico">Tecnológico</SelectItem>
                      <SelectItem value="energetico">Enérgico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/80 text-white font-bold mt-4 border border-primary/50"
                disabled={isGenerating || isSaving}
              >
                {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generando...</> : 
                 isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 
                 <><Sparkles className="mr-2 h-4 w-4" /> Lanzar Motor AI</>}
              </Button>
            </form>

            {systemLogs.length > 0 && (
              <div className="mt-6 p-4 rounded bg-black/80 border border-primary/20 font-mono text-[10px] space-y-1">
                {systemLogs.map((log, i) => <div key={i} className="text-zinc-400 animate-in fade-in slide-in-from-left-1">{log}</div>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10 bg-black/40 h-full flex flex-col relative overflow-hidden">
          <CardHeader><CardTitle className="text-white">Resultado Estratégico</CardTitle></CardHeader>
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
            {!result && !isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                <Database className="h-12 w-12 mb-4" />
                <p>Esperando señal del motor...</p>
              </div>
            )}

            {isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <Sparkles className="h-12 w-12 text-primary animate-pulse mb-4" />
                <h3 className="text-white">Procesando Inteligencia...</h3>
              </div>
            )}

            {result && !isGenerating && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{result.title}</h3>
                  <div className="h-px w-full bg-gradient-to-r from-primary to-transparent" />
                </div>
                <div className="p-3 rounded-md bg-white/5 border border-white/10 text-sm text-zinc-200 whitespace-pre-line">
                  {result.copy}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-2 rounded bg-black/40 border border-white/5 text-[10px] text-zinc-400">
                    <span className="text-secondary block font-bold mb-1">HASHTAGS</span> {result.hashtags}
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/5 text-[10px] text-zinc-400">
                    <span className="text-accent block font-bold mb-1">CTA</span> {result.cta}
                  </div>
                </div>
                <div className="p-3 rounded bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-200">
                  <MessageCircle className="h-3 w-3 inline mr-2" /> {result.whatsapp.message}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
