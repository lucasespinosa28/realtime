import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

/**
 * Configure LogTape for the application
 */
export async function configureLogging() {
  await configure({
    sinks: { 
      console: getConsoleSink()
    },
    loggers: [
      { category: "polymarket", lowestLevel: "debug", sinks: ["console"] },
      { category: "polymarket:app", lowestLevel: "info", sinks: ["console"] },
      { category: "polymarket:websocket", lowestLevel: "warning", sinks: ["console"] },
      { category: "polymarket:airtable", lowestLevel: "info", sinks: ["console"] },
      { category: "polymarket:memory", lowestLevel: "info", sinks: ["console"] },
      { category: "polymarket:scripts", lowestLevel: "info", sinks: ["console"] }
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
