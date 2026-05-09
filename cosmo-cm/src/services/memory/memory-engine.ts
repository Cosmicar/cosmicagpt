import { supabase } from "@/lib/supabase/client";
import { CampaignMemory, PromptPattern } from "@/types/memory";

export class MemoryEngine {
  async saveCampaignMemory(memory: Partial<CampaignMemory>) {
    const { data, error } = await supabase
      .from("campaign_memories")
      .insert([memory])
      .select()
      .single();
    
    return data;
  }

  async getTopPerformingCampaigns(limit = 5) {
    const { data, error } = await supabase
      .from("campaign_memories")
      .select("*, campaigns(*)")
      .order("performance_score", { ascending: false })
      .limit(limit);
    
    return data || [];
  }

  async findSimilarPatterns(promptType: string) {
    const { data, error } = await supabase
      .from("prompt_patterns")
      .select("*")
      .eq("prompt_type", promptType)
      .order("success_score", { ascending: false })
      .limit(3);
    
    return data || [];
  }
}

export const memoryEngine = new MemoryEngine();
