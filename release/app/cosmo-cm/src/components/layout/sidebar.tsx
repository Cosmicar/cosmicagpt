"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, FolderOpen, Calendar, Settings, Zap, Cpu, Brain, Building2, ChevronDown, Server, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Generador IA", href: "/generator", icon: Sparkles },
  { name: "Biblioteca", href: "/library", icon: FolderOpen },
  { name: "Calendario", href: "/calendar", icon: Calendar },
  { name: "Conexiones", href: "/social-connections", icon: LinkIcon },
  { name: "Automatización", href: "/automation-center", icon: Cpu },
  { name: "Infraestructura", href: "/infrastructure", icon: Server },
  { name: "Ajustes", href: "/workspace-settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-black/50 border-r border-white/10 backdrop-blur-xl">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center border border-primary glow-border">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <span className="text-xl font-bold tracking-wider text-white glow-text-primary">COSMO CM</span>
        </div>
      </div>

      {/* Workspace Switcher */}
      <div className="px-4 py-4 border-b border-white/10">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-pointer group">
          <div className="flex items-center gap-3">
             <div className="h-8 w-8 rounded bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center border border-white/10">
                <Building2 className="h-4 w-4 text-white" />
             </div>
             <div className="flex flex-col">
                <span className="text-xs font-bold text-white">Cósmica Agency</span>
                <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">Enterprise Plan</span>
             </div>
          </div>
          <ChevronDown className="h-3 w-3 text-zinc-500 group-hover:text-white" />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto pt-4 px-4 pb-4">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Módulos</div>
        <nav className="flex-1 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-x-3 rounded-md p-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30 glow-border"
                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    isActive ? "text-primary" : "text-zinc-400 group-hover:text-white"
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-3 rounded-md bg-white/5">
          <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center p-[2px]">
            <div className="h-full w-full rounded-full bg-black flex items-center justify-center">
              <span className="text-xs font-bold text-white">CA</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">Admin Cósmica</span>
            <span className="text-xs text-zinc-500">admin@cosmica.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}
