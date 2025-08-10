// import { getAllRecords, updateBuyed, updatePrice } from "../lib/storage";
// import { getBuyedOrder } from "../lib/trading";
// import { configureLogging, scriptsLogger } from "../utils/logger";

// // Setup logging for the script
// await configureLogging();

// /**
//  * Script to update winners for all records in Airtable
//  */
// async function updateAllWinners(table: string = 'Table 1') {
//   scriptsLogger.info("Starting winner update process...");

//   try {
//     const records = await getAllRecords(table);
//     for (const record of records) {
//       //console.log(record)
//       const trade = await getBuyedOrder(record.eventId);
//       if (trade.length > 0) {
//         try {
//           let price = Number(trade[0].price);
//           if (record.outcome != trade[0].outcome) {
//             price = -price + 1.0;
//           }
//           await updatePrice(table, record.airtableId, price);
//           await updateBuyed(table, record.airtableId, true);
//           scriptsLogger.info("Updated price for {event} to {price}", {
//             event: record.event,
//             price: trade[0].price
//           });
//         } catch (error) {
//           scriptsLogger.error("Failed to update price for {event}: {error}", {
//             event: record.event,
//             error: error instanceof Error ? error.message : String(error)
//           });
//         }
//       } else {
//                 await updateBuyed(table, record.airtableId, false);
//         scriptsLogger.info("No trades found for {event}", {
//           event: record.event
//         });
//       }
//     }
//   } catch (error) {
//     scriptsLogger.error("Failed to get records: {error}", {
//       error: error instanceof Error ? error.message : String(error)
//     });
//   }
// }

// // Run if this script is executed directly
// if (require.main === module) {
//   // Get table name from command line arguments, default to 'Table 1'
//   const tableName = process.argv[2] || 'Table 1';

//   updateAllWinners(tableName)
//     .then(() => process.exit(0))
//     .catch((error) => {
//       scriptsLogger.fatal("Script failed: {error}", {
//         error: error instanceof Error ? error.message : String(error)
//       });
//       process.exit(1);
//     });
// }

// export { updateAllWinners };
