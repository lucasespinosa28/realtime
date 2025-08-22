import { configure, getConsoleSink, getLogger } from "@logtape/logtape";
import { getFileSink } from "@logtape/file";

/**
 * Configure LogTape for the application
 */
export async function configureLogging() {
  await configure({
    sinks: { 
      console: getConsoleSink(),
      file: getFileSink("logs/app.log", {
        bufferSize: 8192,
        flushInterval: 5000
      })
    },
    loggers: [
      { category: "polymarket", lowestLevel: "debug", sinks: ["console", "file"] },
      { category: "polymarket:app", lowestLevel: "debug", sinks: ["console", "file"] },
      { category: "polymarket:websocket", lowestLevel: "info", sinks: ["console", "file"] },
      { category: "polymarket:airtable", lowestLevel: "info", sinks: ["console", "file"] },
      { category: "polymarket:memory", lowestLevel: "debug", sinks: ["console", "file"] },
      { category: "polymarket:scripts", lowestLevel: "info", sinks: ["console", "file"] },
      { category: "polymarket:db", lowestLevel: "info", sinks: ["console", "file"] },
      { category: "polymarket:api", lowestLevel: "debug", sinks: ["console", "file"] }
    ]
  });
}

// Export pre-configured loggers for different modules
export const appLogger = getLogger(["polymarket", "app"]);
export const websocketLogger = getLogger(["polymarket", "websocket"]);
export const airtableLogger = getLogger(["polymarket", "airtable"]);
export const memoryLogger = getLogger(["polymarket", "memory"]);
export const scriptsLogger = getLogger(["polymarket", "scripts"]);
export const polymarketAPILogger = getLogger(["polymarket", "api"]);
export const dbLogger = getLogger(["polymarket", "db"]);
