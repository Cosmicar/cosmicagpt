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

-- Políticas RLS (Row Level Security) - Ejemplo básico para acceso público durante desarrollo
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acceso público" ON campaigns FOR ALL USING (true) WITH CHECK (true);
