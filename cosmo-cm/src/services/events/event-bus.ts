import { AutomationEventType } from "@/types/automation";

export type EventPayloads = {
  CAMPAIGN_CREATED: { workflow_id: string; [key: string]: any };
  CAMPAIGN_GENERATED: { title: string; [key: string]: any };
  VISUAL_CREATED: { campaign_id: string; [key: string]: any };
  POST_SCHEDULED: { platform: string; scheduled_for: string; [key: string]: any };
  POST_PUBLISHED: { campaign_id: string; platform: string; [key: string]: any };
  GENERATION_FAILED: { error: string; [key: string]: any };
};

type EventHandler<T extends AutomationEventType> = (data: EventPayloads[T]) => void;

export class EventBus {
  private handlers: Map<AutomationEventType, EventHandler<any>[]> = new Map();

  subscribe<T extends AutomationEventType>(event: T, handler: EventHandler<T>) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)?.push(handler);
    
    return () => {
      const current = this.handlers.get(event) || [];
      this.handlers.set(event, current.filter(h => h !== handler));
    };
  }

  emit<T extends AutomationEventType>(event: T, data: EventPayloads[T]) {
    console.log(`[EventBus] Emitting ${event}`, data);
    this.handlers.get(event)?.forEach(handler => handler(data));
  }
}

export const eventBus = new EventBus();
