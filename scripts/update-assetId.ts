import { getAllRecords, updateAssetAndSizes } from "../lib/storage";
import { getMarket } from "../lib/trading/old/getMarket";
import { configureLogging, scriptsLogger } from "../utils/logger";

await configureLogging();

/**
 * Script to update asset IDs for all records in Airtable
 */

async function updateAllAssetIds(table: string = 'Table 1') {
    scriptsLogger.info("Starting asset ID update process...");

    try {
        const records = await getAllRecords(table);
        for (const record of records) {
            const market = await getMarket(record.eventId)
            let tokenId = "";
            if (record.outcome == "Up") {
                tokenId = market.tokens[0].token_id;
            } else {
                tokenId = market.tokens[1].token_id;
            }

            try {
                await updateAssetAndSizes(table, record.airtableId, tokenId, 0, 0);
                scriptsLogger.info("Updated assetId for {id} to {tokenId}", {
                    id: record.airtableId,
                    tokenId: tokenId
                });
            } catch (error) {
                scriptsLogger.error("Failed to update record {id}: {error}", {
                    id: record.airtableId,
                    error: error instanceof Error ? error.message : String(error)
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

    updateAllAssetIds(tableName)
        .then(() => process.exit(0))
        .catch((error: Error) => {
            scriptsLogger.fatal("Script failed: {error}", {
                error: error instanceof Error ? error.message : String(error)
            });
            process.exit(1);
        });
}

export { updateAllAssetIds };


