import { supabase } from "@/lib/supabase/client";
import { CampaignInput, CampaignOutput, CampaignRecord, CampaignStatus } from "@/types/campaign";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";

export class CampaignStorage {
  async saveCampaign(input: CampaignInput, output: CampaignOutput): Promise<CampaignRecord | null> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) throw new Error("Aislamiento Multi-tenant: No hay workspace activo.");

    const { data, error } = await supabase
      .from("campaigns")
      .insert([
        {
          servicio: input.servicio,
          objetivo: input.objetivo,
          plataforma: input.plataforma,
          formato: input.formato,
          tono: input.tono,
          promocion: input.promocion,
          contexto: input.contexto,
          title: output.title,
          copy: output.copy,
          hashtags: output.hashtags,
          cta: output.cta,
          storyboard: output.storyboard,
          visual_prompt: output.visualPrompt,
          whatsapp_version: output.whatsapp,
          workspace_id: workspace.id,
          status: "draft" as CampaignStatus,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error saving campaign:", error);
      return null;
    }

    return data as CampaignRecord;
  }

  async getCampaigns(filters?: { platform?: string; status?: string }): Promise<CampaignRecord[]> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) return [];

    let query = supabase
      .from("campaigns")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    if (filters?.platform && filters.platform !== "all") {
      query = query.eq("plataforma", filters.platform);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
 
    if (error) {
      console.error("Error fetching campaigns:", error);
      return [];
    }
 
    return (data as any[]).map(item => ({
      ...item,
      visualPrompt: item.visual_prompt,
      whatsapp: item.whatsapp_version
    })) as CampaignRecord[];
  }
 
  async getCampaignById(id: string): Promise<CampaignRecord | null> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) return null;
 
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspace.id)
      .single();
 
    if (error) {
      console.error("Error fetching campaign by id:", error);
      return null;
    }
 
    return {
      ...data,
      visualPrompt: data.visual_prompt,
      whatsapp: data.whatsapp_version
    } as unknown as CampaignRecord;
  }

  async updateCampaign(id: string, updates: Partial<CampaignRecord>): Promise<boolean> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) return false;

    const { error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", workspace.id);

    if (error) {
      console.error("Error updating campaign:", error);
      return false;
    }

    return true;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) return false;

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspace.id);

    if (error) {
      console.error("Error deleting campaign:", error);
      return false;
    }

    return true;
  }
}

export const campaignStorage = new CampaignStorage();
