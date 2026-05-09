import { supabase } from "../lib/supabase/client";
import { loggerEngine } from "../services/logging/logger-engine";

async function createTestPost() {
  loggerEngine.info("Iniciando creación de post de prueba...");

  // 1. Obtener una campaña real existente
  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, title, workspace_id")
    .limit(1);

  if (campaignError || !campaigns || campaigns.length === 0) {
    loggerEngine.error("No se pudo obtener una campaña existente. Crea una campaña primero.", campaignError);
    process.exit(1);
  }

  const campaign = campaigns[0];
  loggerEngine.info(`Usando campaña existente: ${campaign.title} (${campaign.id})`);

  // 2. Definir tiempo (ahora + 1 minuto)
  const scheduledFor = new Date();
  scheduledFor.setMinutes(scheduledFor.getMinutes() + 1);

  // 3. Crear scheduled_post
  const { data: post, error: postError } = await supabase
    .from("scheduled_posts")
    .insert([
      {
        workspace_id: campaign.workspace_id,
        campaign_id: campaign.id,
        platform: "facebook", // Puedes cambiar a "instagram" para probar
        format: "post",
        scheduled_for: scheduledFor.toISOString(),
        status: "scheduled",
        notes: "Post de prueba creado por script"
      }
    ])
    .select()
    .single();

  if (postError) {
    loggerEngine.error("Error al crear el post programado", postError);
    process.exit(1);
  }

  loggerEngine.info(`[Éxito] Post programado creado con ID: ${post.id}`);
  loggerEngine.info(`Programado para: ${scheduledFor.toLocaleString()}`);
  
  process.exit(0);
}

createTestPost();
