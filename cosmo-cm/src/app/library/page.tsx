"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ImageIcon, Video, FileText, LayoutTemplate, Star, Filter, Loader2, Trash2, Calendar, MessageSquare, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { campaignStorage } from "@/services/storage/campaign-storage";
import { CampaignRecord } from "@/types/campaign";
import { Badge } from "@/components/ui/badge";

const tabs = [
  { id: "all", label: "Todo", icon: Star },
  { id: "campaigns", label: "Campañas", icon: LayoutTemplate },
  { id: "reels", label: "Reels", icon: Video },
  { id: "flyers", label: "Flyers", icon: ImageIcon },
  { id: "whatsapp", label: "Estados WA", icon: MessageSquare },
  { id: "storyboards", label: "Storyboards", icon: Zap },
];

export default function Library() {
  const [activeTab, setActiveTab] = useState("all");
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    const data = await campaignStorage.getCampaigns();
    setCampaigns(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar este recurso?")) {
      const success = await campaignStorage.deleteCampaign(id);
      if (success) fetchCampaigns();
    }
  };

  const filteredItems = campaigns.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.servicio.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white glow-text-primary">Biblioteca</h2>
          <p className="text-zinc-400 mt-2">Explora y gestiona todos tus activos estratégicos y visuales.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input 
              placeholder="Buscar recurso..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-black/50 border-white/10 text-white focus-visible:ring-primary"
            />
          </div>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2 custom-scrollbar border-b border-white/5">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            variant="ghost"
            className={cn(
              "rounded-none border-b-2 transition-all px-4 py-2 h-auto",
              activeTab === tab.id 
                ? "border-primary text-primary bg-primary/5" 
                : "border-transparent text-zinc-500 hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon className="h-4 w-4 mr-2" />
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
          {filteredItems.length === 0 ? (
            <div className="col-span-full h-[300px] flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-black/20">
              <FileText className="h-12 w-12 text-zinc-700 mb-4" />
              <p className="text-zinc-500">No hay activos en esta categoría.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <Card key={item.id} className="glass-panel border-white/10 bg-black/40 overflow-hidden group hover:border-primary/50 transition-all duration-300">
                <CardContent className="p-0">
                  <div className="p-4 border-b border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-primary/20 text-primary border-primary/20 uppercase text-[10px]">
                        {item.platform}
                      </Badge>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-white font-bold line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-zinc-400 line-clamp-2">{item.copy}</p>
                  </div>
                  <div className="p-3 bg-black/20 flex justify-between items-center">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white">
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white">
                        <Video className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-zinc-500 hover:text-destructive"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
