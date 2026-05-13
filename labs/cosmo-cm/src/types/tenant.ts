export type UserRole = "owner" | "admin" | "editor" | "viewer";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface WorkspaceSettings {
  ai_context?: string;
  preferred_tone?: string;
  default_platforms?: string[];
}
