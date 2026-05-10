import { Worker, Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis/redis-client";
import { loggerEngine } from "@/services/logging/logger-engine";
import { campaignGenerator } from "@/services/generators/campaign-generator";
import { eventBus } from "@/services/events/event-bus";
import { JobData } from "@/services/jobs/job-engine";

export const createAIWorker = () => {
  const connection = getRedisConnection();
  
  const worker = new Worker(
    "ai-generation-queue",
    async (job: Job<JobData>) => {
      const { workspace_id, payload } = job.data;
      loggerEngine.info(`[AIWorker] Processing job ${job.id} for workspace ${workspace_id}`);
      
      try {
        // Run heavy AI generation outside of the main UI thread
        const output = await campaignGenerator.generate(payload);
        
        // Signal completion (this would typically hit a webhook or update DB directly)
        // For now, we simulate success event if running in same process, 
        // but real isolated workers write to DB and emit Redis Pub/Sub events.
        loggerEngine.info(`[AIWorker] Successfully processed job ${job.id}`);
        return output;
      } catch (error: any) {
        loggerEngine.error(`[AIWorker] Job ${job.id} failed: ${error.message}`);
        throw error; // Let BullMQ handle retries
      }
    },
    { 
      connection,
      concurrency: 5, // Process up to 5 AI jobs concurrently
      limiter: {
        max: 50, // Max 50 jobs
        duration: 60000 // per minute (Rate Limiting at Worker Level)
      }
    }
  );

  worker.on('completed', (job) => {
    loggerEngine.info(`[AIWorker] Job ${job.id} has completed!`);
  });

  worker.on('failed', (job, err) => {
    loggerEngine.critical(`[AIWorker] Job ${job?.id} has failed with ${err.message}`);
  });

  return worker;
};
