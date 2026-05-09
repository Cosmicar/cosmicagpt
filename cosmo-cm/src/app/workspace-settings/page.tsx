"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Palette, Shield, UserPlus, Globe, Layout, Save, Trash2, ShieldCheck, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function WorkspaceSettings() {
  const [orgName, setOrgName] = useState("Cósmica Agency");
  const [slug, setSlug] = useState("cosmica-agency");

  return (
    <div className="flex-1 space-y-6 p-8 pt-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Configuración de Workspace</h2>
          <p className="text-zinc-400 mt-2">Administra la identidad, miembros y permisos de tu organización.</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary uppercase font-mono py-1 px-3">
              PLAN: ENTERPRISE IA
           </Badge>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-12 flex-1 overflow-y-auto custom-scrollbar pr-2">
        {/* Navigation Sidebar (Settings) */}
        <div className="md:col-span-3 space-y-1">
           {[
             { name: "General", icon: Building2, active: true },
             { name: "Miembros", icon: UserPlus, active: false },
             { name: "Branding", icon: Palette, active: false },
             { name: "Seguridad", icon: Shield, active: false },
             { name: "Facturación", icon: CreditCard, active: false },
           ].map(item => (
             <Button 
               key={item.name} 
               variant="ghost" 
               className={cn("w-full justify-start gap-3 h-11 text-sm font-medium", 
                 item.active ? "bg-primary/10 text-primary border border-primary/20" : "text-zinc-400 hover:text-white hover:bg-white/5"
               )}
             >
               <item.icon className="h-4 w-4" />
               {item.name}
             </Button>
           ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-9 space-y-6">
           <Card className="glass-panel border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="text-white text-lg">Información de la Organización</CardTitle>
                <CardDescription>Esta información es visible para todos los miembros del workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-zinc-400">Nombre de la Organización</Label>
                       <Input 
                         value={orgName} 
                         onChange={(e) => setOrgName(e.target.value)}
                         className="bg-black/40 border-white/10 text-white focus:border-primary/50"
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-zinc-400">Slug de la URL</Label>
                       <div className="flex">
                          <span className="flex items-center px-3 rounded-l-md border border-r-0 border-white/10 bg-white/5 text-zinc-500 text-xs">cosmo.cm/</span>
                          <Input 
                            value={slug} 
                            onChange={(e) => setSlug(e.target.value)}
                            className="bg-black/40 border-white/10 text-white focus:border-primary/50 rounded-l-none"
                          />
                       </div>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-zinc-400">Logo de Organización</Label>
                    <div className="flex items-center gap-4">
                       <div className="h-16 w-16 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                          <Globe className="h-8 w-8 text-primary" />
                       </div>
                       <Button variant="outline" className="bg-black/40 border-white/10 text-white">Subir Nuevo Logo</Button>
                       <Button variant="ghost" className="text-zinc-500 hover:text-red-400">Eliminar</Button>
                    </div>
                 </div>
                 <div className="flex justify-end pt-4 border-t border-white/5">
                    <Button className="bg-primary hover:bg-primary/80 text-white">
                       <Save className="h-4 w-4 mr-2" /> Guardar Cambios
                    </Button>
                 </div>
              </CardContent>
           </Card>

           <Card className="glass-panel border-white/10 bg-black/40">
              <CardHeader>
                <CardTitle className="text-white text-lg">Roles y Permisos</CardTitle>
                <CardDescription>Gestiona el aislamiento de datos y acceso por rol.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <ShieldCheck className="h-5 w-5 text-primary" />
                       <div>
                          <p className="text-sm font-bold text-white">Multi-tenant Isolation Active</p>
                          <p className="text-[11px] text-zinc-500">Tus datos están aislados a nivel de base de datos para máxima seguridad.</p>
                       </div>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">VERIFICADO</Badge>
                 </div>
                 <div className="pt-4">
                    <p className="text-xs text-zinc-500 mb-4 uppercase font-mono tracking-widest">Resumen de Miembros</p>
                    <div className="space-y-2">
                       {[
                         { name: "Admin Cósmica", email: "admin@cosmica.com", role: "owner" },
                         { name: "Editor Alpha", email: "editor@cosmica.com", role: "editor" },
                       ].map(m => (
                         <div key={m.email} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                            <div className="flex items-center gap-3">
                               <div className="h-8 w-8 rounded-full bg-zinc-700"></div>
                               <div>
                                  <p className="text-xs font-bold text-white">{m.name}</p>
                                  <p className="text-[10px] text-zinc-500">{m.email}</p>
                               </div>
                            </div>
                            <Badge variant="ghost" className="text-[10px] uppercase text-zinc-400 border-zinc-700">{m.role}</Badge>
                         </div>
                       ))}
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
