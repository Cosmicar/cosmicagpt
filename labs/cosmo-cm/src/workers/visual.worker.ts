import { Worker, Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis/redis-client";
import { loggerEngine } from "@/services/logging/logger-engine";
import { JobData } from "@/services/jobs/job-engine";

export const createVisualWorker = () => {
  const connection = getRedisConnection();
  
  const worker = new Worker(
    "visual-generation-queue",
    async (job: Job<JobData>) => {
      const { workspace_id, payload } = job.data;
      loggerEngine.info(`[VisualWorker] Rendering visuals for job ${job.id}`);
      
      // Simulate heavy rendering/API call
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return { success: true, asset_urls: ["https://cosmo-assets.s3..."] };
    },
    { 
      connection,
      concurrency: 3, // Visuals are heavier, lower concurrency
      limiter: { max: 20, duration: 60000 } 
    }
  );

  return worker;
};
