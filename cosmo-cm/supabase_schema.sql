-- ESTABILIZACIÓN & ARCHITECTURE HARDENING - SUPABASE SCHEMA
-- Todas las tablas son multi-tenant y requieren workspace_id

-- 1. Organizations & Workspaces
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, 
  role TEXT NOT NULL DEFAULT 'viewer', 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Content Engine
CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  servicio TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  plataforma TEXT NOT NULL,
  formato TEXT NOT NULL,
  tono TEXT NOT NULL,
  promocion TEXT,
  contexto TEXT,
  title TEXT NOT NULL,
  copy TEXT NOT NULL,
  hashtags TEXT NOT NULL,
  cta TEXT NOT NULL,
  storyboard TEXT,
  visual_prompt JSONB,
  whatsapp_version JSONB,
  status TEXT DEFAULT 'draft' NOT NULL
);

CREATE TABLE scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  notes TEXT
);

-- 3. Automation & Logs
CREATE TABLE automation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. AI Memory & Knowledge
CREATE TABLE campaign_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  performance_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  conversion_score INTEGER DEFAULT 0,
  viral_score INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE prompt_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL,
  structure TEXT NOT NULL,
  success_score FLOAT DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE viral_structures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  hook TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  emotion TEXT NOT NULL,
  platform TEXT NOT NULL,
  success_rate FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Analytics & Predictions
CREATE TABLE campaign_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  conversion_rate FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE performance_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  predicted_engagement FLOAT DEFAULT 0,
  predicted_viral_score FLOAT DEFAULT 0,
  best_platform TEXT NOT NULL,
  best_posting_time TIMESTAMP WITH TIME ZONE,
  confidence_score FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE engagement_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL, 
  message TEXT NOT NULL,
  impact TEXT NOT NULL, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Reporting
CREATE TABLE executive_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  summary TEXT NOT NULL,
  insights JSONB NOT NULL, 
  recommendations JSONB NOT NULL, 
  performance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Visual Assets (Nuevo)
CREATE TABLE generated_visual_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  asset_url TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- image, video, storyboard
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Social Connections (Meta OAuth)
CREATE TABLE social_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  page_id TEXT,
  instagram_business_id TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  page_name TEXT,
  username TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ROW LEVEL SECURITY (RLS) - POLÍTICA BASE
-- IMPORTANTE: Ejecutar estos comandos para activar el aislamiento real en producción
/*
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Aislamiento Multi-Tenant" ON campaigns
  USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  ));
-- (Repetir para todas las tablas)


