import { supabase } from "@/lib/supabase/client";
import { eventBus, EventPayloads } from "@/services/events/event-bus";
import { AutomationEventType } from "@/types/automation";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";
import { jobEngine } from "@/services/jobs/job-engine";
import { loggerEngine } from "@/services/logging/logger-engine";

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
      eventBus.subscribe(event as any, (data: any) => this.handleEvent(event, data));
    });
  }

  private async handleEvent<T extends AutomationEventType>(type: T, data: EventPayloads[T]) {
    // 1. Log to database
    await this.logEvent(type, data);

    // 2. Dispatch async jobs based on event type
    try {
      switch (type) {
        case "CAMPAIGN_CREATED":
          // When a campaign is created, enqueue AI generation
          await jobEngine.enqueue("ai-generation-queue", "generate-campaign", data, {
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 }
          });
          break;
          
        case "CAMPAIGN_GENERATED":
          // When text is done, enqueue visual generation
          await jobEngine.enqueue("visual-generation-queue", "generate-visuals", data, {
             priority: 2
          });
          break;

        case "POST_SCHEDULED":
          // Just an example of how a scheduled post might hit a queue
          break;
      }
    } catch (error: any) {
      loggerEngine.error(`Failed to dispatch job for event ${type}`, { error: error.message, data });
    }
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
