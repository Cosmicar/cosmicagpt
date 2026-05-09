import { useState, useEffect } from "react";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";
import { Workspace } from "@/types/tenant";

export function useWorkspace() {
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWorkspaces() {
      const data = await workspaceEngine.getWorkspaces();
      setWorkspaces(data);
      
      // Auto-select first workspace if none active
      if (data.length > 0 && !workspaceEngine.getActiveWorkspace()) {
        await workspaceEngine.setActiveWorkspace(data[0].id);
      }
      
      setActiveWorkspace(workspaceEngine.getActiveWorkspace());
      setLoading(false);
    }
    loadWorkspaces();
  }, []);

  const switchWorkspace = async (id: string) => {
    await workspaceEngine.setActiveWorkspace(id);
    setActiveWorkspace(workspaceEngine.getActiveWorkspace());
  };

  return {
    activeWorkspace,
    workspaces,
    loading,
    switchWorkspace,
    organization: (activeWorkspace as any)?.organizations
  };
}
