import { z } from "zod";
import { loggerEngine } from "@/services/logging/logger-engine";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).optional(),
  OPENAI_API_KEY: z.string().optional(),
});

export const validateEnv = () => {
  const isProd = process.env.NODE_ENV === "production";
  
  try {
    const parsed = envSchema.safeParse(process.env);
    
    if (!parsed.success) {
      if (isProd) {
        loggerEngine.critical("Invalid environment variables", parsed.error.format());
        throw new Error("CRITICAL: Invalid environment variables. Halting startup.");
      } else {
        loggerEngine.warn("Invalid environment variables. Running in degraded mode.", parsed.error.format());
      }
      return false;
    }
    
    loggerEngine.info("Environment variables validated successfully.");
    return true;
  } catch (error) {
    console.error("Failed to parse environment variables", error);
    return false;
  }
};
