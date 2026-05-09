import { supabase } from "@/lib/supabase/client";
import { CampaignInput, CampaignOutput, CampaignRecord, CampaignStatus } from "@/types/campaign";

export class CampaignStorage {
  async saveCampaign(input: CampaignInput, output: CampaignOutput): Promise<CampaignRecord | null> {
    const { data, error } = await supabase
      .from("campaigns")
      .insert([
        {
          ...input,
          ...output,
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
    let query = supabase.from("campaigns").select("*").order("created_at", { ascending: false });

    if (filters?.platform && filters.platform !== "all") {
      query = query.eq("platform", filters.platform);
    }

    if (filters?.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching campaigns:", error);
      return [];
    }

    return data as CampaignRecord[];
  }

  async getCampaignById(id: string): Promise<CampaignRecord | null> {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching campaign by id:", error);
      return null;
    }

    return data as CampaignRecord;
  }

  async updateCampaign(id: string, updates: Partial<CampaignRecord>): Promise<boolean> {
    const { error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", id);

    if (error) {
      console.error("Error updating campaign:", error);
      return false;
    }

    return true;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting campaign:", error);
      return false;
    }

    return true;
  }
}

export const campaignStorage = new CampaignStorage();
