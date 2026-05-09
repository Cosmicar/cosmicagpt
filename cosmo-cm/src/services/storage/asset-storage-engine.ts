import { supabase } from "@/lib/supabase/client";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";

export type AssetType = "image" | "video" | "pdf" | "storyboard" | "export";

export interface VisualAsset {
  id: string;
  workspace_id: string;
  campaign_id?: string;
  asset_type: AssetType;
  storage_path: string;
  mime_type: string;
  size: number;
  metadata?: any;
  created_at: string;
}

export class AssetStorageEngine {
  private BUCKET_NAME = "cosmo-assets";

  async uploadAsset(file: File, assetType: AssetType, campaignId?: string): Promise<VisualAsset | null> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) throw new Error("Aislamiento Multi-tenant: No hay workspace activo.");

    // Validate size and mime type based on asset type
    this.validateFile(file, assetType);

    const fileExt = file.name.split(".").pop();
    const fileName = `${workspace.id}/${assetType}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    try {
      // 1. Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Persist record in database
      const { data: assetData, error: dbError } = await supabase
        .from("generated_visual_assets")
        .insert([{
          workspace_id: workspace.id,
          campaign_id: campaignId,
          asset_type: assetType,
          storage_path: uploadData.path,
          mime_type: file.type,
          size: file.size,
          metadata: { originalName: file.name }
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      return assetData as VisualAsset;

    } catch (error) {
      console.error("[AssetStorageEngine] Error uploading asset:", error);
      return null;
    }
  }

  async getAssetUrl(path: string): Promise<string> {
    const { data } = supabase.storage.from(this.BUCKET_NAME).getPublicUrl(path);
    return data.publicUrl;
  }

  async getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
     const { data, error } = await supabase.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(path, expiresIn);
      
     if (error) {
       console.error("[AssetStorageEngine] Error generating signed URL:", error);
       return null;
     }
     
     return data.signedUrl;
  }

  async deleteAsset(id: string, path: string): Promise<boolean> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) return false;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([path]);

      if (storageError) throw storageError;

      // Delete from DB (RLS will ensure it only deletes if it belongs to workspace)
      const { error: dbError } = await supabase
        .from("generated_visual_assets")
        .delete()
        .eq("id", id)
        .eq("workspace_id", workspace.id);

      if (dbError) throw dbError;

      return true;
    } catch (error) {
      console.error("[AssetStorageEngine] Error deleting asset:", error);
      return false;
    }
  }

  private validateFile(file: File, assetType: AssetType) {
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${MAX_SIZE / 1024 / 1024}MB`);
    }
    
    // Add specific mime type validation logic here if needed
  }
}

export const assetStorageEngine = new AssetStorageEngine();
