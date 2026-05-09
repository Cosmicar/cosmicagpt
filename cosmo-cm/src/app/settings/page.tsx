"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Key, Database, MessageCircle, Settings as SettingsIcon, Save, Webhook } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-6 p-8 pt-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Configuración</h2>
          <p className="text-zinc-400 mt-2">Administra tus integraciones y llaves de API.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/80 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          <Save className="mr-2 h-4 w-4" />
          Guardar Cambios
        </Button>
      </div>

      <div className="grid gap-6">
        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <CardTitle className="text-white">OpenAI API</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Requerido para el generador de campañas y prompts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="openai-key" className="text-zinc-300">API Key</Label>
              <Input 
                id="openai-key" 
                type="password" 
                placeholder="sk-..." 
                defaultValue="sk-placeholder-key-for-demo-purposes"
                className="bg-black/50 border-white/10 text-white focus-visible:ring-primary max-w-xl font-mono text-sm" 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-secondary" />
              <CardTitle className="text-white">Meta Graph API</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Integración para publicación directa en Instagram y Facebook.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="meta-app-id" className="text-zinc-300">App ID</Label>
                <Input id="meta-app-id" placeholder="1234567890" className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-app-secret" className="text-zinc-300">App Secret</Label>
                <Input id="meta-app-secret" type="password" placeholder="••••••••••••••••" className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="meta-token" className="text-zinc-300">Access Token Permanente</Label>
                <Input id="meta-token" type="password" placeholder="EAA..." className="bg-black/50 border-white/10 text-white focus-visible:ring-primary font-mono text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              <CardTitle className="text-white">Supabase</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Base de datos y autenticación.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="supabase-url" className="text-zinc-300">Project URL</Label>
                <Input id="supabase-url" placeholder="https://xxxx.supabase.co" className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supabase-anon" className="text-zinc-300">Anon Key</Label>
                <Input id="supabase-anon" type="password" placeholder="eyJ..." className="bg-black/50 border-white/10 text-white focus-visible:ring-primary font-mono text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border-white/10 bg-black/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-400" />
              <CardTitle className="text-white">WhatsApp Business API</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Para envío automatizado de mensajes y seguimiento de leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
              <div className="space-y-2">
                <Label htmlFor="wa-phone-id" className="text-zinc-300">Phone Number ID</Label>
                <Input id="wa-phone-id" placeholder="1234567890" className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wa-token" className="text-zinc-300">Access Token</Label>
                <Input id="wa-token" type="password" placeholder="EAA..." className="bg-black/50 border-white/10 text-white focus-visible:ring-primary font-mono text-sm" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-panel border-white/10 bg-black/40 mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-accent" />
              <CardTitle className="text-white">Automatizaciones (Webhooks)</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Conecta Cosmo CM con Zapier, Make u otros servicios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-xl">
              <Label htmlFor="webhook-url" className="text-zinc-300">Endpoint Principal</Label>
              <div className="flex gap-2">
                <Input id="webhook-url" placeholder="https://tu-endpoint.com/webhook" className="bg-black/50 border-white/10 text-white focus-visible:ring-primary" />
                <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/20 border border-white/10">Probar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
