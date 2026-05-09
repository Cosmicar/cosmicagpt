import { supabase } from "@/lib/supabase/client";
import { UserRole } from "@/types/tenant";

export class AuthService {
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  }

  async getUserMemberships(userId: string) {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("*, workspaces(*, organizations(*))")
      .eq("user_id", userId);
    
    return data || [];
  }

  async getRoleInWorkspace(userId: string, workspaceId: string): Promise<UserRole> {
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("user_id", userId)
      .eq("workspace_id", workspaceId)
      .single();
    
    return (data?.role as UserRole) || "viewer";
  }

  async signOut() {
    await supabase.auth.signOut();
  }
}

export const authService = new AuthService();
