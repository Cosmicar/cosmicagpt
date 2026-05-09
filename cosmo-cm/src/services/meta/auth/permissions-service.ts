import { metaClient } from "../meta-client";
import { loggerEngine } from "@/services/logging/logger-engine";

export class MetaPermissionsService {
  async verifyPermissions(accessToken: string) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/me/permissions?access_token=${accessToken}`);
      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);

      const grantedPermissions = data.data
        .filter((p: any) => p.status === "granted")
        .map((p: any) => p.permission);

      const requiredPermissions = [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "instagram_basic",
        "instagram_content_publish"
      ];

      const missingPermissions = requiredPermissions.filter(p => !grantedPermissions.includes(p));

      return {
        isValid: missingPermissions.length === 0,
        granted: grantedPermissions,
        missing: missingPermissions
      };
    } catch (error: any) {
      loggerEngine.error("Error verifying Meta permissions", error);
      return { isValid: false, granted: [], missing: [], error: error.message };
    }
  }
}

export const metaPermissions = new MetaPermissionsService();
