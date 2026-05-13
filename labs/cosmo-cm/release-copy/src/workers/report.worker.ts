import { Worker, Job } from "bullmq";
import { getRedisConnection } from "@/lib/redis/redis-client";
import { loggerEngine } from "@/services/logging/logger-engine";
import { JobData } from "@/services/jobs/job-engine";

export const createReportWorker = () => {
  const connection = getRedisConnection();
  
  const worker = new Worker(
    "reporting-queue",
    async (job: Job<JobData>) => {
      loggerEngine.info(`[ReportWorker] Generating PDF for job ${job.id}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return { success: true, pdf_url: "https://cosmo-reports..." };
    },
    { connection, concurrency: 2 }
  );

  return worker;
};
