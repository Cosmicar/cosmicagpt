import { startSchedulerWorker } from "../workers/scheduler.worker";
import { loggerEngine } from "../services/logging/logger-engine";

loggerEngine.info("=== INICIANDO WORKER DE PRODUCCIÓN ===");

// Iniciar el worker
const stopWorker = startSchedulerWorker();

// Manejo de señales para Graceful Shutdown
process.on('SIGTERM', () => {
    loggerEngine.info("Recibida señal SIGTERM. Deteniendo worker...");
    stopWorker();
    process.exit(0);
});

process.on('SIGINT', () => {
    loggerEngine.info("Recibida señal SIGINT. Deteniendo worker...");
    stopWorker();
    process.exit(0);
});

// Mantener el proceso vivo
loggerEngine.info("Worker corriendo y esperando tareas.");
