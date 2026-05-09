import { Queue, JobsOptions } from "bullmq";
import { getRedisConnection } from "@/lib/redis/redis-client";
import { workspaceEngine } from "@/services/workspaces/workspace-engine";
import { loggerEngine } from "@/services/logging/logger-engine";

export type QueueName = 
  | "ai-generation-queue"
  | "visual-generation-queue"
  | "reporting-queue"
  | "analytics-queue"
  | "scheduler-queue";

export interface JobData {
  workspace_id: string;
  payload: any;
  metadata?: any;
}

export class JobEngine {
  private queues: Map<QueueName, Queue> = new Map();
  private connection = getRedisConnection();

  constructor() {
    loggerEngine.info("[JobEngine] Initializing Real BullMQ Queues...");
    const queueNames: QueueName[] = [
      "ai-generation-queue",
      "visual-generation-queue",
      "reporting-queue",
      "analytics-queue",
      "scheduler-queue"
    ];

    queueNames.forEach(name => {
      this.queues.set(name, new Queue(name, { 
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 24 * 3600 }, // Keep completed jobs for 24 hours
          removeOnFail: { age: 7 * 24 * 3600 }, // Keep failed jobs for 7 days
        }
      }));
    });
  }

  async enqueue(queueName: QueueName, jobName: string, data: any, options?: JobsOptions): Promise<string> {
    const workspace = workspaceEngine.getActiveWorkspace();
    if (!workspace) throw new Error("Aislamiento Multi-tenant: No hay workspace activo para encolar el job.");

    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found.`);

    const jobData: JobData = {
      workspace_id: workspace.id,
      payload: data,
      metadata: {
        enqueued_at: new Date().toISOString()
      }
    };

    try {
      const job = await queue.add(jobName, jobData, options);
      loggerEngine.info(`Job enqueued in ${queueName}`, { jobId: job.id, jobName, workspace_id: workspace.id });
      return job.id as string;
    } catch (error: any) {
      loggerEngine.error(`Failed to enqueue job in ${queueName}`, { error: error.message, jobName });
      throw error;
    }
  }

  async getJobStatus(queueName: QueueName, jobId: string): Promise<string> {
    const queue = this.queues.get(queueName);
    if (!queue) return "unknown";

    const job = await queue.getJob(jobId);
    if (!job) return "not_found";

    const state = await job.getState();
    return state;
  }

  async getQueueMetrics(queueName: QueueName) {
    const queue = this.queues.get(queueName);
    if (!queue) return { waiting: 0, active: 0, completed: 0, failed: 0 };

    const jobCounts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed');
    return {
      waiting: jobCounts.waiting,
      active: jobCounts.active,
      completed: jobCounts.completed,
      failed: jobCounts.failed,
    };
  }
}

export const jobEngine = new JobEngine();
