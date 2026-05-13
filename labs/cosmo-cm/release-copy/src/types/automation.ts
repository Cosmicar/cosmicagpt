export type AutomationEventType = 
  | "CAMPAIGN_CREATED" 
  | "CAMPAIGN_GENERATED" 
  | "VISUAL_CREATED" 
  | "POST_SCHEDULED" 
  | "POST_PUBLISHED" 
  | "GENERATION_FAILED";

export interface AutomationLog {
  id: string;
  event_type: AutomationEventType;
  status: "info" | "success" | "warning" | "error";
  message: string;
  metadata?: any;
  created_at: string;
}

export interface WorkflowState {
  id: string;
  name: string;
  status: "idle" | "running" | "completed" | "failed";
  progress: number;
  current_task?: string;
  logs: string[];
}

export interface PipelineStatus {
  active_workflows: number;
  events_count: number;
  system_health: "optimal" | "warning" | "critical";
  last_sync: string;
}
