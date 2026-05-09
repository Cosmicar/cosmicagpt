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

-- Políticas RLS (Row Level Security) - Ejemplo básico para acceso público durante desarrollo
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Acceso público" ON campaigns FOR ALL USING (true) WITH CHECK (true);
