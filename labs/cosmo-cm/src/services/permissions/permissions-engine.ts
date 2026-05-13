import { UserRole } from "@/types/tenant";

export class PermissionsEngine {
  private rolePermissions: Record<UserRole, string[]> = {
    owner: ["*"],
    admin: ["view_analytics", "edit_campaigns", "manage_scheduler", "view_reports", "manage_members"],
    editor: ["view_analytics", "edit_campaigns", "manage_scheduler", "view_reports"],
    viewer: ["view_analytics", "view_reports"],
  };

  can(role: UserRole, action: string): boolean {
    const permissions = this.rolePermissions[role];
    if (permissions.includes("*")) return true;
    return permissions.includes(action);
  }

  isAtLeast(current: UserRole, required: UserRole): boolean {
    const hierarchy: UserRole[] = ["viewer", "editor", "admin", "owner"];
    return hierarchy.indexOf(current) >= hierarchy.indexOf(required);
  }
}

export const permissionsEngine = new PermissionsEngine();
