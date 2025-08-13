import { getAllRecords, updateBuyed, updatePrice } from "../lib/storage";
import { getBuyedOrder } from "../lib/trading/old/getBuyedOrder";
import { configureLogging, scriptsLogger } from "../utils/logger";

await configureLogging();

/**
 * Script to update prices for all records in Airtable
 */
async function updateAllPrices(table: string = 'Table 1') {
    scriptsLogger.info("Starting price update process...");

    try {
        const records = await getAllRecords(table);
        for (const record of records) {
            const trade = await getBuyedOrder(record.eventId);
            if (trade.length > 0 && record.buyed) {
                try {
                    let price = Number(trade[0].price);
                    if (record.outcome != trade[0].outcome) {
                        price = -price + 1.0;
                    }
                    await updatePrice(table, record.airtableId, price);
                    scriptsLogger.info("Updated price for {event} to {price}", {
                        event: record.event,
                        price
                    });
                } catch (error) {
                    scriptsLogger.error("Failed to update price for {event}: {error}", {
                        event: record.event,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            } else {
                await updateBuyed(table, record.airtableId, false);
                scriptsLogger.info("No trades found for {event}", {
                    event: record.event
                });
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

    updateAllPrices(tableName)
        .then(() => process.exit(0))
        .catch((error: Error) => {
            scriptsLogger.fatal("Script failed: {error}", {
                error: error instanceof Error ? error.message : String(error)
            });
            process.exit(1);
        });
}

export { updateAllPrices };
