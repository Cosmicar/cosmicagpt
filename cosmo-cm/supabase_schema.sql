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

