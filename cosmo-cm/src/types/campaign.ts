export type Platform = "instagram" | "facebook" | "linkedin" | "omnichannel";
export type Format = "reel" | "carrusel" | "post" | "historia";
export type Tone = "tecnologico" | "profesional" | "cercano" | "energetico";
export type Objective = "ventas" | "leads" | "branding" | "educacion";
export type CampaignStatus = "draft" | "active" | "archived" | "scheduled";

export interface CampaignInput {
  servicio: string;
  objetivo: Objective;
  plataforma: Platform;
  formato: Format;
  tono: Tone;
  promocion?: string;
  contexto?: string;
}

export interface ReelScene {
  id: number;
  duration: string;
  visual: string;
  audio: string;
}

export interface VisualPrompt {
  description: string;
  style: string;
  aspectRatio: string;
  rawPrompt: string;
  imageUrl?: string;
  url?: string;
}

export interface WhatsAppVersion {
  message: string;
  callToAction: string;
}

export interface CampaignOutput {
  title: string;
  copy: string;
  hashtags: string;
  cta: string;
  storyboard?: string;
  scenes?: ReelScene[];
  visualPrompt: VisualPrompt;
  whatsapp: WhatsAppVersion;
  mocked?: boolean;
}

// Database specific types
export interface CampaignRecord extends CampaignInput, CampaignOutput {
  id: string;
  created_at: string;
  status: CampaignStatus;
  user_id?: string;
}

export type CampaignDBResponse = CampaignRecord;
