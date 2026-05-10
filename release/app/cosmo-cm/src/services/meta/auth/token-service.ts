import { supabase } from "@/lib/supabase/client";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";
import { loggerEngine } from "@/services/logging/logger-engine";

export class TokenService {
  // En producción real, este servicio usaría encriptación asimétrica o kms
  // para guardar access_tokens antes de enviarlos a DB.

  private encryptToken(token: string): string {
    // Simulando encriptación
    return Buffer.from(token).toString('base64');
  }

  private decryptToken(encryptedToken: string): string {
    // Simulando desencriptación
    return Buffer.from(encryptedToken, 'base64').toString('ascii');
  }

  async saveMetaTokens(workspaceId: string, tokens: {
    accessToken: string;
    expiresIn: number;
    platformUserId: string;
    pageId?: string;
    instagramId?: string;
    pageName?: string;
    username?: string;
  }) {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expiresIn);

    const { error } = await supabase.from('social_connections').upsert({
      workspace_id: workspaceId,
      platform: 'meta',
      platform_user_id: tokens.platformUserId,
      access_token: this.encryptToken(tokens.accessToken),
      token_expires_at: expiresAt.toISOString(),
      page_id: tokens.pageId,
      instagram_business_id: tokens.instagramId,
      page_name: tokens.pageName,
      username: tokens.username,
    }, { onConflict: 'workspace_id, platform' });

    if (error) {
      loggerEngine.error("Error saving Meta tokens", error);
      throw error;
    }
  }

  async getActiveToken(workspaceId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('social_connections')
      .select('access_token, token_expires_at')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'meta')
      .single();

    if (error || !data) return null;

    // Verificar si expiró
    if (new Date(data.token_expires_at) < new Date()) {
      loggerEngine.warn(`Token para workspace ${workspaceId} expirado.`);
      return null; // O iniciar flujo de refresh
    }

    return this.decryptToken(data.access_token);
  }
}

export const tokenService = new TokenService();
