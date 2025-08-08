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
    scriptsLogger.info("Found {count} records to check", { count: records.length });
    
    let updated = 0;
    let errors = 0;
    
    for (const record of records) {
      try {
        const result = await getWinner(record.conditionId);
        
        if (result.isResolved && result.winner !== "draw") {
          await updateWinner(table,record.airtableId, result.winner);
          scriptsLogger.info("Updated record {airtableId}: {winner}", {
            airtableId: record.airtableId,
            winner: result.winner
          });
          updated++;
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        scriptsLogger.error("Error updating record {airtableId}: {error}", {
          airtableId: record.airtableId,
          error: error instanceof Error ? error.message : String(error)
        });
        errors++;
      }
    }
    
    scriptsLogger.info("Completed. Updated: {updated}, Errors: {errors}", { updated, errors });
    
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
