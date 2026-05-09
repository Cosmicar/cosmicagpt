import { eventBus } from "@/services/events/event-bus";
import { memoryEngine } from "@/services/memory/memory-engine";

export class LearningEngine {
  constructor() {
    this.initListeners();
  }

  private initListeners() {
    eventBus.subscribe("POST_PUBLISHED", (data) => this.processLearning(data));
  }

  async processLearning(data: any) {
    // In a real system, we'd wait for actual performance data from Meta API
    // Here we simulate the learning from a successful post
    console.log("Processing learning from published post:", data);
    
    await memoryEngine.saveCampaignMemory({
      campaign_id: data.campaign_id,
      performance_score: Math.floor(Math.random() * 100),
      engagement_score: Math.floor(Math.random() * 100),
      created_at: new Date().toISOString(),
    });
  }
}

export const learningEngine = new LearningEngine();
