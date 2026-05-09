import { supabase } from "@/lib/supabase/client";
import { eventBus } from "@/services/events/event-bus";
import { AutomationEventType } from "@/types/automation";

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
      eventBus.subscribe(event, (data) => this.logEvent(event, data));
    });
  }

  async logEvent(type: AutomationEventType, data: any) {
    const message = this.getEventMessage(type, data);
    
    await supabase.from("automation_logs").insert([
      {
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
    const { data, error } = await supabase
      .from("automation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    
    return data || [];
  }
}

export const automationEngine = new AutomationEngine();
