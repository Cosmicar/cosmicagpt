export type ReportType = 
  | "weekly" 
  | "monthly" 
  | "campaign_performance" 
  | "viral_opportunity" 
  | "ai_strategic";

export interface ExecutiveReport {
  id: string;
  report_type: ReportType;
  period_start: string;
  period_end: string;
  summary: string;
  insights: string[];
  recommendations: string[];
  performance_score: number;
  created_at: string;
  metadata?: any;
}

export interface ReportSummary {
  executive_summary: string;
  conclusions: string[];
  opportunities: string[];
  alerts: string[];
}
