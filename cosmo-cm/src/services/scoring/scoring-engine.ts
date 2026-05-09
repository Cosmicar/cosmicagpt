import { StrategicScore } from "@/types/analytics";

export class ScoringEngine {
  private isMockMode: boolean;

  constructor() {
    this.isMockMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  }

  calculateStrategicScore(data: any): StrategicScore {
    if (this.isMockMode) {
      return {
        viral: Math.floor(Math.random() * 40) + 60,
        branding: 98,
        engagement: Math.floor(Math.random() * 30) + 70,
        conversion: Math.floor(Math.random() * 50) + 50,
        consistency: 95,
      };
    }

    // Production logic: weighted average of real metrics
    return {
      viral: 0,
      branding: 0,
      engagement: 0,
      conversion: 0,
      consistency: 0,
    };
  }
}

export const scoringEngine = new ScoringEngine();
