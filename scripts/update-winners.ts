import { getAllRecords, updateWinner } from "../lib/storage";
import { getWinner } from "../lib/trading";
import { configureLogging, scriptsLogger } from "../utils/logger";

await configureLogging();

/**
 * Script to update winners for all records in Airtable
 */
async function updateAllWinners(table: string = 'Table 1') {
    scriptsLogger.info("Starting winner update process...");

    try {
        const records = await getAllRecords(table);
        for (const record of records) {
            if (record.winner === "Undefined") {
                const polymarket = await getWinner(record.eventId);
                if (polymarket.isResolved) {
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

if (require.main === module) {
    const tableName = process.argv[2] || 'Table 1';

    updateAllWinners(tableName)
        .then(() => process.exit(0))
        .catch((error: Error) => {
            scriptsLogger.fatal("Script failed: {error}", {
                error: error instanceof Error ? error.message : String(error)
            });
            process.exit(1);
        });
}

export { updateAllWinners };
