"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Copy, CheckCircle2, MessageCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Generator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    
    // Simulate API call
    setTimeout(() => {
      setResult({
        title: "Revoluciona tu gestión con IA",
        copy: "¿Cansado de perder horas en tareas manuales? 🚀 Descubre cómo nuestra nueva solución basada en IA puede automatizar tus flujos de trabajo y multiplicar tu productividad.\n\nEn Cósmica, hemos desarrollado un sistema inteligente que aprende de tus rutinas y optimiza cada proceso.\n\n¿Listo para dar el salto tecnológico?",
        hashtags: "#Tech #SaaS #InteligenciaArtificial #Productividad #CosmicaTech #Innovacion",
        cta: "Haz clic en el enlace de nuestra bio para solicitar tu demo gratuita hoy mismo.",
        storyboard: "1. Hook (0-3s): Pantalla dividida mostrando frustración manual vs fluidez automática.\n2. Valor (3-10s): Gráficos holográficos ascendentes mostrando el incremento de productividad.\n3. Producto (10-15s): Interfaz de la aplicación en modo oscuro con acentos azul eléctrico.\n4. CTA (15-20s): Logo de Cósmica con botón de 'Solicitar Demo'.",
        prompt: "Crea una imagen fotorrealista de un espacio de trabajo del futuro, iluminación con neón azul eléctrico y naranja, con pantallas holográficas mostrando gráficos de crecimiento, estilo cyberpunk minimalista, 4k, renderizado en octane.",
        whatsapp: "¡Hola! 🚀 Notamos que te interesa optimizar tus procesos. En Cósmica acabamos de lanzar nuestra nueva herramienta de IA. ¿Te gustaría agendar una demo rápida de 10 min para mostrártela? Es sin compromiso. 👇"
      });
      setIsGenerating(false);
    }, 2500);
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Generador de Campañas</h2>
        <p className="text-zinc-400 mt-2">Configura los parámetros para generar contenido impulsado por IA.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 flex-1 min-h-0">
        {/* Form Column */}
        <Card className="glass-panel border-white/10 bg-black/40 h-full flex flex-col">
          <CardHeader>
            <CardTitle className="text-white">Parámetros</CardTitle>
            <CardDescription className="text-zinc-400">Define los detalles de tu nueva campaña</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={handleGenerate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="servicio" className="text-zinc-300">Servicio/Producto</Label>
                <Input id="servicio" placeholder="Ej: Plataforma SaaS, Desarrollo Web..." className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="objetivo" className="text-zinc-300">Objetivo</Label>
                  <Select required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white focus:ring-primary">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="ventas">Ventas / Conversión</SelectItem>
                      <SelectItem value="leads">Generación de Leads</SelectItem>
                      <SelectItem value="branding">Awareness / Branding</SelectItem>
                      <SelectItem value="educacion">Educativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="plataforma" className="text-zinc-300">Plataforma</Label>
                  <Select required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white focus:ring-primary">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="omnichannel">Omnicanal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formato" className="text-zinc-300">Formato</Label>
                  <Select required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white focus:ring-primary">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="reel">Reel / Video Corto</SelectItem>
                      <SelectItem value="carrusel">Carrusel</SelectItem>
                      <SelectItem value="post">Post Estático (Flyer)</SelectItem>
                      <SelectItem value="historia">Historia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tono" className="text-zinc-300">Tono</Label>
                  <Select required>
                    <SelectTrigger className="bg-black/50 border-white/10 text-white focus:ring-primary">
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 text-white">
                      <SelectItem value="tecnologico">Tecnológico & Futuro</SelectItem>
                      <SelectItem value="profesional">Profesional & Serio</SelectItem>
                      <SelectItem value="cercano">Cercano & Casual</SelectItem>
                      <SelectItem value="energetico">Enérgico & Directo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="promocion" className="text-zinc-300">Promoción (Opcional)</Label>
                <Input id="promocion" placeholder="Ej: 20% off mes 1, Demo Gratis..." className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contexto" className="text-zinc-300">Contexto Adicional</Label>
                <Textarea 
                  id="contexto" 
                  placeholder="Instrucciones especiales, palabras clave obligatorias, etc." 
                  className="bg-black/50 border-white/10 text-white focus-visible:ring-primary resize-none h-24" 
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/80 text-white font-bold mt-4 border border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Procesando IA...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Campaña
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results Column */}
        <Card className="glass-panel border-white/10 bg-black/40 h-full flex flex-col relative overflow-hidden">
          {/* Subtle background glow when result exists */}
          {result && (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 pointer-events-none"></div>
          )}
          
          <CardHeader>
            <CardTitle className="text-white">Salida IA</CardTitle>
            <CardDescription className="text-zinc-400">Resultados listos para publicar</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto custom-scrollbar">
            {!result && !isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-50">
                <Sparkles className="h-12 w-12 text-primary/50 mb-4" />
                <p className="text-zinc-400">Completa el formulario y genera tu campaña para ver los resultados aquí.</p>
              </div>
            )}

            {isGenerating && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="relative w-24 h-24 mb-6">
                  <div className="absolute inset-0 border-t-2 border-primary rounded-full animate-spin"></div>
                  <div className="absolute inset-2 border-r-2 border-secondary rounded-full animate-spin animation-delay-200"></div>
                  <div className="absolute inset-4 border-b-2 border-accent rounded-full animate-spin animation-delay-400"></div>
                  <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary animate-pulse" />
                </div>
                <h3 className="text-lg font-medium text-white glow-text-primary mb-2">Conectando con Cosmos AI</h3>
                <p className="text-zinc-400 text-sm animate-pulse">Optimizando tokens y generando variaciones...</p>
              </div>
            )}

            {result && !isGenerating && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Title */}
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">{result.title}</h3>
                  <div className="h-px w-full bg-gradient-to-r from-primary to-transparent"></div>
                </div>

                {/* Copy */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-primary font-semibold text-xs uppercase tracking-wider">Copy Sugerido</Label>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="p-3 rounded-md bg-white/5 border border-white/10 text-sm text-zinc-200 whitespace-pre-line leading-relaxed">
                    {result.copy}
                  </div>
                </div>

                {/* Hashtags & CTA */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-secondary font-semibold text-xs uppercase tracking-wider">Hashtags</Label>
                    <div className="p-2 rounded-md bg-white/5 border border-white/10 text-xs text-zinc-300">
                      {result.hashtags}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-accent font-semibold text-xs uppercase tracking-wider">Call to Action</Label>
                    <div className="p-2 rounded-md bg-white/5 border border-white/10 text-xs text-zinc-300">
                      {result.cta}
                    </div>
                  </div>
                </div>

                {/* Storyboard */}
                <div className="space-y-2">
                  <Label className="text-primary font-semibold text-xs uppercase tracking-wider">Storyboard / Guion Visual</Label>
                  <div className="p-3 rounded-md bg-white/5 border border-white/10 text-sm text-zinc-200 whitespace-pre-line">
                    {result.storyboard}
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-emerald-400 font-semibold text-xs uppercase tracking-wider flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      Mensaje WhatsApp
                    </Label>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-400 hover:text-white">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="p-3 rounded-md bg-emerald-950/30 border border-emerald-500/20 text-sm text-emerald-100 whitespace-pre-line relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-md"></div>
                    {result.whatsapp}
                  </div>
                </div>

                {/* Image Prompt */}
                <div className="space-y-2">
                  <Label className="text-zinc-400 font-semibold text-xs uppercase tracking-wider">Midjourney / DALL-E Prompt</Label>
                  <div className="p-3 rounded-md bg-black/60 border border-dashed border-white/20 text-xs text-zinc-400 italic">
                    {result.prompt}
                  </div>
                </div>

                <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Guardar en Biblioteca
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
