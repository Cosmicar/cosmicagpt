export interface CampaignMemory {
  id: string;
  campaign_id: string;
  performance_score: number;
  engagement_score: number;
  conversion_score: number;
  viral_score: number;
  notes?: string;
  created_at: string;
}

export interface PromptPattern {
  id: string;
  prompt_type: string;
  structure: string;
  success_score: number;
  usage_count: number;
  created_at: string;
}

export interface ViralStructure {
  id: string;
  hook: string;
  pattern_type: string;
  emotion: string;
  platform: string;
  success_rate: number;
  created_at: string;
}

export interface KnowledgeContext {
  similar_campaigns: string[];
  suggested_hooks: string[];
  branding_rules: string[];
  historical_context: string;
}
