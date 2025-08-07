import { memoryLogger } from "./logger";

/**
 * Memory monitoring and cleanup utilities
 */

/**
 * Format bytes to MB
 */
export function formatMB(bytes: number): number {
  return Math.round(bytes / 1024 / 1024 * 100) / 100;
}

/**
 * Log current memory usage
 */
export function logMemoryUsage(): void {
  const used = process.memoryUsage();
  memoryLogger.info("Memory usage - RSS: {rss}MB, Heap Used: {heapUsed}MB", {
    rss: formatMB(used.rss),
    heapUsed: formatMB(used.heapUsed)
  });
}

/**
 * Force garbage collection if available and memory usage is high
 */
export function forceGCIfNeeded(thresholdMB: number = 100): void {
  const used = process.memoryUsage();
  if (global.gc && used.heapUsed > thresholdMB * 1024 * 1024) {
    memoryLogger.info("Forcing garbage collection - heap usage: {heapUsedMB}MB", {
      heapUsedMB: formatMB(used.heapUsed)
    });
    global.gc();
  }
}

/**
 * Setup memory monitoring interval
 */
export function setupMemoryMonitoring(intervalMs: number = 60000, gcThresholdMB: number = 100): NodeJS.Timeout {
  return setInterval(() => {
    logMemoryUsage();
    forceGCIfNeeded(gcThresholdMB);
  }, intervalMs);
}

/**
 * Setup graceful shutdown handlers
 */
export function setupGracefulShutdown(): void {
  process.on('SIGTERM', () => {
    memoryLogger.info("Received SIGTERM, shutting down gracefully...");
    process.exit(0);
  });

  process.on('SIGINT', () => {
    memoryLogger.info("Received SIGINT, shutting down gracefully...");
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    memoryLogger.fatal("Uncaught Exception: {error}", { error: error.message });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    memoryLogger.fatal("Unhandled Rejection at: {promise} reason: {reason}", { 
      promise: String(promise), 
      reason: String(reason) 
    });
    process.exit(1);
  });
}
