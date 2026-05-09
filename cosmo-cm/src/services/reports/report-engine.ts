import { supabase } from "@/lib/supabase/client";
import { ExecutiveReport, ReportType } from "@/types/reports";
import { summaryEngine } from "@/services/summaries/summary-engine";

export class ReportEngine {
  async generateReport(type: ReportType, start: Date, end: Date): Promise<ExecutiveReport | null> {
    const summaryData = summaryEngine.generateExecutiveSummary(type);
    
    const report: Partial<ExecutiveReport> = {
      report_type: type,
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      summary: summaryData.executive_summary,
      insights: summaryData.conclusions,
      recommendations: summaryData.opportunities,
      performance_score: Math.floor(Math.random() * 20) + 75, // 75-95 range
    };

    const { data, error } = await supabase
      .from("executive_reports")
      .insert([report])
      .select()
      .single();

    if (error) {
      console.error("Error saving executive report:", error);
      return null;
    }

    return data as ExecutiveReport;
  }

  async getReportHistory(): Promise<ExecutiveReport[]> {
    const { data, error } = await supabase
      .from("executive_reports")
      .select("*")
      .order("created_at", { ascending: false });
    
    return data || [];
  }
}

export const reportEngine = new ReportEngine();
