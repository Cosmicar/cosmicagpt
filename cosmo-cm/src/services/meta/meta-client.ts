import { loggerEngine } from "@/services/logging/logger-engine";
import { tokenService } from "./auth/token-service";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";
import { supabase } from "@/lib/supabase/client";

export class MetaClient {
  private baseUrl = "https://graph.facebook.com/v19.0";

  private async getActiveConnection() {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) throw new Error("Aislamiento Multi-tenant: No hay workspace activo.");

    const { data, error } = await supabase
      .from('social_connections')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('platform', 'meta')
      .single();

    if (error || !data) {
      return null;
    }

    return {
      accessToken: await tokenService.getActiveToken(workspace.id),
      pageId: data.page_id,
      instagramId: data.instagram_business_id
    };
  }

  async post(endpoint: string, data: any) {
    const connection = await this.getActiveConnection();
    const isTestMode = process.env.TEST_MODE === "true";
    
    if (!connection || !connection.accessToken) {
      if (isTestMode) {
        loggerEngine.warn("Meta token missing or expired. Running in MOCK MODE because TEST_MODE=true.");
        return { id: `mock_post_${Date.now()}` };
      } else {
        throw new Error("No hay token de Meta válido o activo para este workspace. Configura la conexión primero.");
      }
    }

    try {
      const url = `${this.baseUrl}/${endpoint}?access_token=${connection.accessToken}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error.message);
      }

      return result;
    } catch (error: any) {
      loggerEngine.error(`Meta API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  async getPageId() { 
    const conn = await this.getActiveConnection();
    return conn?.pageId;
  }
  
  async getInstagramId() { 
    const conn = await this.getActiveConnection();
    return conn?.instagramId;
  }
}

export const metaClient = new MetaClient();
