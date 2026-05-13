import { workspaceEngine } from "@/services/workspaces/workspace-engine";

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  workspace_id?: string;
  metadata?: any;
}

export class LoggerEngine {
  private isProduction = process.env.NODE_ENV === "production";

  log(level: LogLevel, message: string, metadata?: any) {
    const workspace = workspaceEngine.getActiveWorkspace();
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      workspace_id: workspace?.id,
      metadata
    };

    // In a real SaaS, this would send data to Sentry, DataDog, or BetterStack
    this.outputToConsole(entry);
    
    if (level === "error" || level === "critical") {
      this.captureException(entry);
    }
  }

  info(message: string, metadata?: any) { this.log("info", message, metadata); }
  warn(message: string, metadata?: any) { this.log("warn", message, metadata); }
  error(message: string, metadata?: any) { this.log("error", message, metadata); }
  critical(message: string, metadata?: any) { this.log("critical", message, metadata); }
  debug(message: string, metadata?: any) { 
    if (!this.isProduction) this.log("debug", message, metadata); 
  }

  private outputToConsole(entry: LogEntry) {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]${entry.workspace_id ? ` [WS:${entry.workspace_id.substring(0,6)}]` : ''}`;
    
    switch (entry.level) {
      case "info": console.info(prefix, entry.message, entry.metadata || ''); break;
      case "warn": console.warn(prefix, entry.message, entry.metadata || ''); break;
      case "error": console.error(prefix, entry.message, entry.metadata || ''); break;
      case "critical": console.error(`🚨 FATAL: ${prefix}`, entry.message, entry.metadata || ''); break;
      case "debug": console.log(prefix, entry.message, entry.metadata || ''); break;
    }
  }

  private captureException(entry: LogEntry) {
    // Simulate Sentry/PostHog capture
    if (this.isProduction) {
      // Sentry.captureException(new Error(entry.message), { extra: entry.metadata });
      console.error("[LoggerEngine] Error captured for external monitoring.", entry.message);
    }
  }
}

export const loggerEngine = new LoggerEngine();
