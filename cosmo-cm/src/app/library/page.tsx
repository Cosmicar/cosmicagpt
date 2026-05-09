"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Image as ImageIcon, Video, FileText, LayoutTemplate, Star, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

const filters = [
  { id: "all", label: "Todo", icon: Star },
  { id: "reels", label: "Reels", icon: Video },
  { id: "flyers", label: "Flyers", icon: ImageIcon },
  { id: "prompts", label: "Prompts", icon: FileText },
  { id: "campaigns", label: "Campañas", icon: LayoutTemplate },
];

const mockItems = [
  { id: 1, type: "reels", title: "Lanzamiento SaaS", date: "09 May 2026", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop" },
  { id: 2, type: "flyers", title: "Promo 50% Off", date: "08 May 2026", image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2000&auto=format&fit=crop" },
  { id: 3, type: "prompts", title: "Cyberpunk Office", date: "07 May 2026", image: "https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?q=80&w=2000&auto=format&fit=crop" },
  { id: 4, type: "campaigns", title: "Campaña B2B", date: "05 May 2026", image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2000&auto=format&fit=crop" },
  { id: 5, type: "reels", title: "Tutorial UI/UX", date: "04 May 2026", image: "https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=2000&auto=format&fit=crop" },
  { id: 6, type: "flyers", title: "Webinar AI", date: "02 May 2026", image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=2000&auto=format&fit=crop" },
];

export default function Library() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filteredItems = mockItems.filter(item => activeFilter === "all" || item.type === activeFilter);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Biblioteca de Contenido</h2>
          <p className="text-zinc-400 mt-2">Gestiona todos tus recursos generados en un solo lugar.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Buscar contenido..." 
              className="pl-9 bg-black/50 border-white/10 text-white focus-visible:ring-primary"
            />
          </div>
          <Button variant="outline" className="bg-black/50 border-white/10 text-white hover:bg-white/5">
            <Filter className="h-4 w-4 mr-2" />
            Filtrar
          </Button>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 custom-scrollbar">
        {filters.map((filter) => (
          <Button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            variant={activeFilter === filter.id ? "default" : "outline"}
            className={cn(
              "rounded-full transition-all",
              activeFilter === filter.id 
                ? "bg-primary text-white border-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                : "bg-black/40 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10"
            )}
          >
            <filter.icon className="h-4 w-4 mr-2" />
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-6">
        {filteredItems.map((item) => (
          <Card key={item.id} className="glass-panel border-white/10 bg-black/40 overflow-hidden group cursor-pointer hover:border-primary/50 transition-all duration-300">
            <div className="relative h-48 w-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10"></div>
              {/* Using a regular img tag for prototype simplicity, normally we'd use next/image */}
              <img 
                src={item.image} 
                alt={item.title} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute bottom-3 left-3 z-20 flex flex-col">
                <span className="text-white font-semibold text-lg drop-shadow-md">{item.title}</span>
                <span className="text-zinc-300 text-xs">{item.date}</span>
              </div>
              <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs text-primary border border-primary/30 uppercase font-bold tracking-wider">
                {item.type}
              </div>
            </div>
            <CardContent className="p-4 flex justify-between items-center bg-black/40">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">Ver detalles</Button>
              <Button size="sm" className="bg-primary/20 text-primary hover:bg-primary hover:text-white transition-colors">
                Usar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
