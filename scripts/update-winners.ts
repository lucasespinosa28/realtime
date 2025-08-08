import { getAllRecords, updateWinner } from "../lib/airtable";
import { getWinner } from "../lib/polymarket";
import { configureLogging, scriptsLogger } from "../utils/logger";

// Setup logging for the script
await configureLogging();

/**
 * Script to update winners for all records in Airtable
 */
async function updateAllWinners(table: string = 'Table 1') {
  scriptsLogger.info("Starting winner update process...");

  try {
    const records = await getAllRecords(table);
    for (const record of records) {
      if(record.winner === "Undefined"){
        const polymarket = await getWinner(record.eventId);
        if(polymarket.isResolved){
          await updateWinner(table, record.airtableId, polymarket.winner);
          scriptsLogger.info("Updated winner for {event} to {winner}", {
            event: record.event,
            winner: polymarket.winner
          });
        }
      }
    }

  } catch (error) {
    scriptsLogger.error("Failed to get records: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Run if this script is executed directly
if (require.main === module) {
  updateAllWinners()
    .then(() => process.exit(0))
    .catch((error) => {
      scriptsLogger.fatal("Script failed: {error}", {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    });
}

export { updateAllWinners };
