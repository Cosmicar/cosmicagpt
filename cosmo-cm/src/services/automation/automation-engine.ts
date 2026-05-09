import { supabase } from "@/lib/supabase/client";
import { eventBus, EventPayloads } from "@/services/events/event-bus";
import { AutomationEventType } from "@/types/automation";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";

export class AutomationEngine {
  constructor() {
    this.initListeners();
  }

  private initListeners() {
    const events: AutomationEventType[] = [
      "CAMPAIGN_CREATED",
      "CAMPAIGN_GENERATED",
      "VISUAL_CREATED",
      "POST_SCHEDULED",
      "POST_PUBLISHED",
      "GENERATION_FAILED"
    ];

    events.forEach(event => {
      eventBus.subscribe(event as any, (data: any) => this.logEvent(event, data));
    });
  }

  async logEvent<T extends AutomationEventType>(type: T, data: EventPayloads[T]) {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) return;

    const message = this.getEventMessage(type, data);
    
    await supabase.from("automation_logs").insert([
      {
        workspace_id: workspace.id,
        event_type: type,
        status: type === "GENERATION_FAILED" ? "error" : "success",
        message,
        metadata: data,
      }
    ]);
  }

  private getEventMessage(type: AutomationEventType, data: any): string {
    switch (type) {
      case "CAMPAIGN_GENERATED": return `Inteligencia Cósmica generó exitosamente: ${data.title}`;
      case "POST_SCHEDULED": return `Publicación programada para ${data.platform} el ${new Date(data.scheduled_for).toLocaleDateString()}`;
      case "VISUAL_CREATED": return `Assets visuales creados para campaña ID: ${data.campaign_id}`;
      case "GENERATION_FAILED": return `Fallo crítico en motor IA: ${data.error}`;
      default: return `Evento de sistema registrado: ${type}`;
    }
  }

  async getLogs(limit = 50) {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) return [];

    const { data } = await supabase
      .from("automation_logs")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    
    return data || [];
  }
}

export const automationEngine = new AutomationEngine();
