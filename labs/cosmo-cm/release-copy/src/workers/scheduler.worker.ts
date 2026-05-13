import { supabase } from "@/lib/supabase/client";
import { autoPublisher } from "@/services/meta/auto-publisher";
import { loggerEngine } from "@/services/logging/logger-engine";

export function startSchedulerWorker() {
  loggerEngine.info("[SchedulerWorker] Iniciando worker de publicación automática...");

  // Polling cada 30 segundos
  const intervalId = setInterval(async () => {
    try {
      const now = new Date().toISOString();
      
      loggerEngine.debug(`[SchedulerWorker] Buscando publicaciones para ejecutar...`);

      // 1. Consultar posts programados que ya deberían haberse publicado
      const { data: posts, error } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("status", "scheduled")
        .lte("scheduled_for", now);

      if (error) {
        throw new Error(`Error al consultar scheduled_posts: ${error.message}`);
      }

      if (posts && posts.length > 0) {
        loggerEngine.info(`[SchedulerWorker] Encontrados ${posts.length} posts para publicar.`);
        
        // 2. Procesar cada post
        for (const post of posts) {
          loggerEngine.info(`[SchedulerWorker] Procesando post ID: ${post.id}`);
          await autoPublisher.publishScheduledPost(post);
        }
      }

    } catch (error: any) {
      loggerEngine.error("[SchedulerWorker] Error global en el loop del worker", error);
    }
  }, 30000); // 30 segundos

  return () => {
    loggerEngine.info("[SchedulerWorker] Deteniendo worker...");
    clearInterval(intervalId);
  };
}

// Auto-iniciar si estamos en un entorno que lo requiere (por ejemplo, si este archivo se importa en el arranque del server)
// En Next.js esto puede ser tricky si corre en serverless, pero el usuario especificó que correrá en un VPS con Docker.
// startSchedulerWorker();
