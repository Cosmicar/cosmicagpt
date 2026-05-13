import { startSchedulerWorker } from "../workers/scheduler.worker";
import { loggerEngine } from "../services/logging/logger-engine";

// Forzar modo test si no está definido
if (process.env.TEST_MODE !== "false") {
    process.env.TEST_MODE = "true";
}

loggerEngine.info("=== INICIANDO TEST DEL SCHEDULER ===");
loggerEngine.info(`MODO TEST: ${process.env.TEST_MODE}`);

// Iniciar el worker
const stopWorker = startSchedulerWorker();

loggerEngine.info("Worker iniciado. Presiona Ctrl+C para detener.");
loggerEngine.info("Esperando publicaciones programadas...");

// Mantener el proceso vivo
process.on('SIGINT', () => {
    loggerEngine.info("Deteniendo test...");
    stopWorker();
    process.exit(0);
});
