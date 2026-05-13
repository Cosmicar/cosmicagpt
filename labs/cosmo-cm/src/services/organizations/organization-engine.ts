import { supabase } from "@/lib/supabase/client";
import { Organization } from "@/types/tenant";

export class OrganizationEngine {
  async getOrganization(id: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", id)
      .single();
    
    return data;
  }

  async updateOrganization(id: string, updates: Partial<Organization>) {
    const { data, error } = await supabase
      .from("organizations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return data;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    const { data, error } = await supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .single();
    
    return data;
  }
}

export const organizationEngine = new OrganizationEngine();
