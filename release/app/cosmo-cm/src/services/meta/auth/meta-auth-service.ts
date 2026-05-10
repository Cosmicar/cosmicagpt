import { loggerEngine } from "@/services/logging/logger-engine";
import { tokenService } from "./token-service";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";

export class MetaAuthService {
  private appId = process.env.NEXT_PUBLIC_META_APP_ID;
  private appSecret = process.env.META_APP_SECRET; // Only available server-side ideally, but for MVP keeping it simple
  private redirectUri = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/meta/callback` : "http://localhost:3000/api/auth/meta/callback";

  getLoginUrl(workspaceId: string): string {
    const scopes = [
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "instagram_basic",
      "instagram_content_publish"
    ].join(",");

    const state = Buffer.from(JSON.stringify({ workspaceId })).toString('base64');

    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${this.appId}&redirect_uri=${this.redirectUri}&scope=${scopes}&state=${state}`;
  }

  async exchangeCodeForToken(code: string, workspaceId: string) {
    loggerEngine.info(`Exchanging OAuth code for Meta token (Workspace: ${workspaceId})`);

    try {
      // 1. Exchange Code
      const tokenResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?client_id=${this.appId}&redirect_uri=${this.redirectUri}&client_secret=${this.appSecret}&code=${code}`);
      const tokenData = await tokenResponse.json();

      if (tokenData.error) throw new Error(tokenData.error.message);

      const shortLivedToken = tokenData.access_token;

      // 2. Exchange for Long-Lived Token
      const longLivedResponse = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${this.appId}&client_secret=${this.appSecret}&fb_exchange_token=${shortLivedToken}`);
      const longLivedData = await longLivedResponse.json();

      if (longLivedData.error) throw new Error(longLivedData.error.message);

      const accessToken = longLivedData.access_token;
      const expiresIn = longLivedData.expires_in || 60 * 60 * 24 * 60; // default to 60 days

      // 3. Get User ID & Pages
      const meResponse = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`);
      const meData = await meResponse.json();

      const pagesResponse = await fetch(`https://graph.facebook.com/v19.0/${meData.id}/accounts?access_token=${accessToken}`);
      const pagesData = await pagesResponse.json();
      
      const primaryPage = pagesData.data?.[0]; // Default to first page
      let instagramId = null;

      if (primaryPage) {
        const igResponse = await fetch(`https://graph.facebook.com/v19.0/${primaryPage.id}?fields=instagram_business_account&access_token=${accessToken}`);
        const igData = await igResponse.json();
        instagramId = igData.instagram_business_account?.id;
      }

      // 4. Save to Database
      await tokenService.saveMetaTokens(workspaceId, {
        accessToken,
        expiresIn,
        platformUserId: meData.id,
        pageId: primaryPage?.id,
        instagramId,
        pageName: primaryPage?.name,
      });

      return { success: true };
    } catch (error: any) {
      loggerEngine.error("Meta Auth Error", error);
      throw error;
    }
  }
}

export const metaAuthService = new MetaAuthService();
