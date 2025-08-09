import { getAllRecords, updateAssetAndSizes } from "../lib/storage";
import { getMarket } from "../lib/trading";
import { configureLogging, scriptsLogger } from "../utils/logger";

// Setup logging for the script
await configureLogging();

/**
 * Script to update winners for all records in Airtable
 */

//  tokens: [
// //     {
// //       token_id: "96715985867211326107894615219659372381856735114718488156700914994568506414026",
// //       outcome: "Up",
// //       price: 1,
// //       winner: true,
// //     }, {
// //       token_id: "29216910307759357183660748367662255727439053482730980471670325547016944897356",
// //       outcome: "Down",
// //       price: 0,
// //       winner: false,
// //     }
// //   ],
async function updateAllWinners(table: string = 'Table 1') {
  scriptsLogger.info("Starting winner update process...");

  try {
    const records = await getAllRecords(table);
    for (const record of records) {
      const market = await getMarket(record.eventId)
      console.log(record.eventId)
      console.log(record.outcome)
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
      // const market = await getMarket(record.eventId)
      // console.log(market)
      // console.log()
      // if(record.winner === "Undefined"){
      //   // const polymarket = await getWinner(record.eventId);
      //   // if(polymarket.isResolved){
      //   //   await updateWinner(table, record.airtableId, polymarket.winner);
      //   //   scriptsLogger.info("Updated winner for {event} to {winner}", {
      //   //     event: record.event,
      //   //     winner: polymarket.winner
      //   //   });
      //   // }
      // }
    }

  } catch (error) {
    scriptsLogger.error("Failed to get records: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

// Run if this script is executed directly
if (require.main === module) {
  // Get table name from command line arguments, default to 'Table 1'
  const tableName = process.argv[2] || 'Table 1';

  updateAllWinners(tableName)
    .then(() => process.exit(0))
    .catch((error) => {
      scriptsLogger.fatal("Script failed: {error}", {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    });
}

export { updateAllWinners };


