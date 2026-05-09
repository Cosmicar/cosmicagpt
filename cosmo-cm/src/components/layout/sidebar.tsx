"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, FolderOpen, Calendar, Settings, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Generador IA", href: "/generator", icon: Sparkles },
  { name: "Biblioteca", href: "/library", icon: FolderOpen },
  { name: "Calendario", href: "/calendar", icon: Calendar },
  { name: "Analytics", href: "/analytics", icon: Activity },
  { name: "Configuración", href: "/settings", icon: Settings },
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
      <div className="flex flex-1 flex-col overflow-y-auto pt-6 px-4 pb-4">
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
