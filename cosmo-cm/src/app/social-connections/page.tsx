"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Instagram, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { metaAuthService } from "@/services/meta/auth/meta-auth-service";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";
import { supabase } from "@/lib/supabase/client";

export default function SocialConnections() {
  const [connection, setConnection] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const workspace = workspaceEngine.getActiveWorkspace();

  useEffect(() => {
    fetchConnection();
  }, [workspace]);

  const fetchConnection = async () => {
    if (!workspace) return;
    setLoading(true);
    
    const { data } = await supabase
      .from('social_connections')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('platform', 'meta')
      .single();

    setConnection(data);
    setLoading(false);
  };

  const handleConnect = () => {
    if (!workspace) return;
    const authUrl = metaAuthService.getLoginUrl(workspace.id);
    window.location.href = authUrl;
  };

  const handleDisconnect = async () => {
    if (!workspace) return;
    if (confirm("¿Seguro que deseas desconectar Meta?")) {
       await supabase.from('social_connections').delete().eq('workspace_id', workspace.id).eq('platform', 'meta');
       setConnection(null);
    }
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Conexiones Sociales</h2>
          <p className="text-zinc-400 mt-2">Gestiona las cuentas de redes sociales vinculadas a tu espacio.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 text-primary animate-spin" /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
          <Card className="glass-panel border-white/10 bg-black/40">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Facebook className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-white">Meta (Facebook & Instagram)</CardTitle>
                  <CardDescription className="text-zinc-400">Publicación automática en Pages y cuentas Business.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {connection ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-500">Conectado Exitosamente</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        Página: <span className="text-white font-medium">{connection.page_name || connection.page_id}</span>
                      </p>
                      {connection.instagram_business_id && (
                        <p className="text-xs text-zinc-400">
                          Instagram: <span className="text-white font-medium">Vinculado</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                     <Button variant="outline" className="border-white/10 hover:bg-white/5 text-white" onClick={handleConnect}>
                       Reconectar
                     </Button>
                     <Button variant="destructive" onClick={handleDisconnect}>
                       Desconectar
                     </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-lg flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-zinc-400 mt-0.5" />
                    <p className="text-sm text-zinc-400">
                      Conecta tu cuenta de Meta para habilitar la publicación directa. Necesitas tener rol de Administrador en la Página de Facebook.
                    </p>
                  </div>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={handleConnect}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Conectar con Meta
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
