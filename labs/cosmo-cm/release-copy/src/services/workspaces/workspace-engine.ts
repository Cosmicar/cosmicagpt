import { supabase } from "@/lib/supabase/client";
import { Workspace, Organization } from "@/types/tenant";

export class WorkspaceEngine {
  private currentWorkspace: Workspace | null = null;

  async getWorkspaces(): Promise<Workspace[]> {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("name", { ascending: true });
    
    return data || [];
  }

  async setActiveWorkspace(workspaceId: string) {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*, organizations(*)")
      .eq("id", workspaceId)
      .single();
    
    if (data) {
      this.currentWorkspace = data;
      // In a real app, you might save this in local storage or a cookie
      console.log(`[WorkspaceEngine] Active workspace set to: ${data.name}`);
    }
  }

  getActiveWorkspace(): Workspace | null {
    return this.currentWorkspace;
  }

  getWorkspaceIsolationFilter() {
    return this.currentWorkspace ? { workspace_id: this.currentWorkspace.id } : {};
  }
}

export const workspaceEngine = new WorkspaceEngine();
