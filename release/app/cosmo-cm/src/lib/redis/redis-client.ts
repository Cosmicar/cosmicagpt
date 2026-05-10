import { Redis } from "ioredis";
import { loggerEngine } from "@/services/logging/logger-engine";

const redisUrl = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL;

const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !redisUrl) {
  throw new Error("FATAL: UPSTASH_REDIS_URL is missing in production environment.");
}

// Global Redis instance for BullMQ (Requires TCP connection)
const redisConnection = redisUrl 
  ? new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  : new Redis({ host: "localhost", port: 6379, maxRetriesPerRequest: null }); // Fallback for local dev

redisConnection.on("error", (err) => {
  loggerEngine.error("Redis Connection Error", { error: err.message });
});

redisConnection.on("ready", () => {
  loggerEngine.info("Redis Connection Ready");
});

export const getRedisConnection = () => redisConnection;
