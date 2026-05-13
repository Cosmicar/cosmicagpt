export interface CampaignAnalytics {
  id: string;
  campaign_id: string;
  platform: string;
  views: number;
  likes: number;
  shares: number;
  comments: number;
  clicks: number;
  engagement_rate: number;
  conversion_rate: number;
  created_at: string;
}

export interface PerformancePrediction {
  id: string;
  campaign_id: string;
  predicted_engagement: number;
  predicted_viral_score: number;
  best_platform: string;
  best_posting_time: string;
  confidence_score: number;
  created_at: string;
}

export interface EngagementInsight {
  id: string;
  type: "trend" | "alert" | "suggestion";
  message: string;
  impact: "high" | "medium" | "low";
  created_at: string;
}

export interface StrategicScore {
  viral: number;
  branding: number;
  engagement: number;
  conversion: number;
  consistency: number;
}
