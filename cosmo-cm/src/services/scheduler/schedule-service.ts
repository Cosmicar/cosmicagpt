import { supabase } from "@/lib/supabase/client";
import { ScheduledPost, ScheduleInput, CalendarEvent } from "@/types/schedule";

export class ScheduleService {
  async createSchedule(input: ScheduleInput): Promise<ScheduledPost | null> {
    const { data, error } = await supabase
      .from("scheduled_posts")
      .insert([
        {
          campaign_id: input.campaign_id,
          platform: input.platform,
          format: input.format,
          scheduled_for: input.scheduled_for.toISOString(),
          status: "scheduled",
          notes: input.notes,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating schedule:", error);
      return null;
    }

    return data as ScheduledPost;
  }

  async getScheduledPosts(): Promise<ScheduledPost[]> {
    // In a real app we'd join with campaigns to get the title
    const { data, error } = await supabase
      .from("scheduled_posts")
      .select("*, campaigns(title)")
      .order("scheduled_for", { ascending: true });

    if (error) {
      console.error("Error fetching scheduled posts:", error);
      return [];
    }

    return data.map(post => ({
      ...post,
      campaign_title: post.campaigns?.title || "Campaña Desconocida"
    })) as ScheduledPost[];
  }

  async deleteSchedule(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", id);

    return !error;
  }

  getPlatformColor(platform: string): string {
    switch (platform.toLowerCase()) {
      case "instagram": return "bg-pink-500/20 text-pink-400 border-pink-500/30";
      case "facebook": return "bg-blue-600/20 text-blue-500 border-blue-600/30";
      case "whatsapp": return "bg-emerald-600/20 text-emerald-500 border-emerald-600/30";
      case "linkedin": return "bg-blue-800/20 text-blue-400 border-blue-800/30";
      default: return "bg-zinc-800 text-zinc-400 border-zinc-700";
    }
  }
}

export const scheduleService = new ScheduleService();
