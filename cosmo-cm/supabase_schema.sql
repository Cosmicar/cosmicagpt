-- Estructura SQL sugerida para Supabase Core
-- Tabla: campaigns

CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Input Fields
  servicio TEXT NOT NULL,
  objetivo TEXT NOT NULL,
  plataforma TEXT NOT NULL,
  formato TEXT NOT NULL,
  tono TEXT NOT NULL,
  promocion TEXT,
  contexto TEXT,
  
  -- Output Fields
  title TEXT NOT NULL,
  copy TEXT NOT NULL,
  hashtags TEXT NOT NULL,
  cta TEXT NOT NULL,
  storyboard TEXT,
  visual_prompt JSONB, -- Estructura: {description, style, aspectRatio, rawPrompt}
  whatsapp_version JSONB, -- Estructura: {message, callToAction}
  
  -- Metadata
  status TEXT DEFAULT 'draft' NOT NULL,
  user_id UUID -- Opcional para auth futuro
);
-- Tabla: scheduled_posts
CREATE TABLE scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'scheduled' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

-- Políticas RLS para scheduled_posts
-- ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acceso público scheduler" ON scheduled_posts FOR ALL USING (true) WITH CHECK (true);
-- Tabla: automation_logs
CREATE TABLE automation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas RLS para automation_logs
-- ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acceso público logs" ON automation_logs FOR ALL USING (true) WITH CHECK (true);

-- Políticas RLS (Row Level Security) - Ejemplo básico para acceso público durante desarrollo
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acceso público" ON campaigns FOR ALL USING (true) WITH CHECK (true);

-- TABLA: campaign_memories
CREATE TABLE campaign_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  performance_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  conversion_score INTEGER DEFAULT 0,
  viral_score INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: prompt_patterns
CREATE TABLE prompt_patterns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt_type TEXT NOT NULL,
  structure TEXT NOT NULL,
  success_score FLOAT DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: viral_structures
CREATE TABLE viral_structures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hook TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  emotion TEXT NOT NULL,
  platform TEXT NOT NULL,
  success_rate FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: knowledge_embeddings (Preparada para extensiones vectoriales)
CREATE TABLE knowledge_embeddings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB,
  -- vector_data vector(1536), -- Descomentar si se habilita pgvector
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: campaign_analytics
CREATE TABLE campaign_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- TABLA: performance_predictions
CREATE TABLE performance_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  predicted_engagement FLOAT DEFAULT 0,
  predicted_viral_score FLOAT DEFAULT 0,
  best_platform TEXT NOT NULL,
  best_posting_time TIMESTAMP WITH TIME ZONE,
  confidence_score FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: engagement_insights
CREATE TABLE engagement_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL, -- trend, alert, suggestion
  message TEXT NOT NULL,
  impact TEXT NOT NULL, -- high, medium, low
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: executive_reports
CREATE TABLE executive_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_type TEXT NOT NULL,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  summary TEXT NOT NULL,
  insights JSONB NOT NULL, -- Array de strings
  recommendations JSONB NOT NULL, -- Array de strings
  performance_score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- MULTI-TENANT CORE
-- TABLA: organizations
CREATE TABLE organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: workspaces
CREATE TABLE workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: workspace_members
CREATE TABLE workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Relación con auth.users
  role TEXT NOT NULL DEFAULT 'viewer', -- owner, admin, editor, viewer
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLA: workspace_settings
CREATE TABLE workspace_settings (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- NOTA: Todas las tablas existentes (campaigns, scheduled_posts, automation_logs, etc.)
-- deben incluir una columna workspace_id UUID REFERENCES workspaces(id) para aislamiento de datos.




