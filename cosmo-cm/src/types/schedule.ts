export type ScheduleStatus = "draft" | "scheduled" | "processing" | "published" | "failed";

export interface ScheduledPost {
  id: string;
  campaign_id: string;
  platform: string;
  format: string;
  scheduled_for: string; // ISO string
  status: ScheduleStatus;
  created_at: string;
  published_at?: string;
  notes?: string;
  // Included from campaign relation in joins
  campaign_title?: string;
}

export interface ScheduleInput {
  campaign_id: string;
  platform: string;
  format: string;
  scheduled_for: Date;
  notes?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  platform: string;
  status: ScheduleStatus;
  color: string;
}
