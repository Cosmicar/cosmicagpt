import { AutomationEventType } from "@/types/automation";

type EventHandler = (data: any) => void;

export class EventBus {
  private handlers: Map<AutomationEventType, EventHandler[]> = new Map();

  subscribe(event: AutomationEventType, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)?.push(handler);
    
    // Return unsubscribe function
    return () => {
      const current = this.handlers.get(event) || [];
      this.handlers.set(event, current.filter(h => h !== handler));
    };
  }

  emit(event: AutomationEventType, data: any) {
    console.log(`[EventBus] Emitting ${event}`, data);
    this.handlers.get(event)?.forEach(handler => handler(data));
  }
}

export const eventBus = new EventBus();
