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
import { QuickShare } from "@/components/whatsapp/quick-share";

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
  const [sharingCampaign, setSharingCampaign] = useState<CampaignRecord | null>(null);

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

  // Real Filtering Logic
  const filteredItems = campaigns.filter(c => {
    const matchesSearch = c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        c.servicio.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "campaigns") return matchesSearch; // Basic campaigns always show in 'campaigns'
    if (activeTab === "reels") return matchesSearch && c.formato?.toLowerCase().includes("reel");
    if (activeTab === "flyers") return matchesSearch && (c.formato?.toLowerCase().includes("flyer") || c.formato?.toLowerCase().includes("imagen"));
    if (activeTab === "whatsapp") return matchesSearch && c.whatsapp;
    if (activeTab === "storyboards") return matchesSearch && c.storyboard;
    
    return matchesSearch;
  });

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
              <p className="text-zinc-500 text-sm">No se encontraron activos en esta categoría.</p>
              <Button variant="ghost" className="mt-2 text-primary" onClick={() => {setSearchTerm(""); setActiveTab("all")}}>
                Limpiar filtros
              </Button>
            </div>
          ) : (
            filteredItems.map((item) => (
              <Card key={item.id} className="glass-panel border-white/10 bg-black/40 overflow-hidden group hover:border-primary/50 transition-all duration-300">
                <CardContent className="p-0">
                  <div className="p-4 border-b border-white/5 space-y-3 min-h-[140px]">
                    <div className="flex justify-between items-start">
                      <Badge className="bg-primary/20 text-primary border-primary/20 uppercase text-[9px]">
                        {item.plataforma}
                      </Badge>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-white font-bold text-sm line-clamp-1">{item.title}</h3>
                    <p className="text-[11px] text-zinc-400 line-clamp-3 leading-relaxed">{item.copy}</p>
                  </div>
                  <div className="p-3 bg-black/20 flex justify-between items-center">
                    <div className="flex justify-between items-center w-full">
                      <div className="flex gap-1">
                        {item.storyboard && (
                          <Badge variant="outline" className="h-6 px-1.5 border-white/5 bg-white/5">
                            <Zap className="h-3 w-3 text-secondary" />
                          </Badge>
                        )}
                        {item.whatsapp && (
                          <Badge variant="outline" className="h-6 px-1.5 border-white/5 bg-white/5">
                            <MessageSquare className="h-3 w-3 text-emerald-500" />
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          onClick={() => setSharingCampaign(item)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-zinc-500 hover:text-destructive transition-colors"
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Quick Share Panel overlay */}
      {sharingCampaign && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <QuickShare campaign={sharingCampaign} />
            <Button variant="outline" className="w-full border-white/10 text-white hover:bg-white/5" onClick={() => setSharingCampaign(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
