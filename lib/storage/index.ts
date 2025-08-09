import Airtable from "airtable";
import { extractCoinFromEvent } from "../../utils/time";
import { airtableLogger } from "../../utils/logger";

const baseId = process.env.BASE_ID;
const apiKey = process.env.API_KEY;

if (!baseId) {
  throw new Error('Missing BASE_ID environment variable');
}
if (!apiKey) {
  throw new Error('Missing API_KEY environment variable');
}

Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: apiKey
});

const base = Airtable.base(baseId);

export interface TradeRecord {
  eventId: string;
  coin: string;
  price: number;
  event: string;
  outcome: string;
  url: string;
  winner: string;
}

export interface TradeRecordWithId extends TradeRecord {
  airtableId: string;
}

/**
 * Create a new record in Airtable
 */
export function createRecord(table: string, record: TradeRecord): Promise<string> {
  return new Promise((resolve, reject) => {
    base(table).create([
      {
        fields: {
          eventId: record.eventId,
          coin: record.coin,
          price: record.price,
          event: record.event,
          outcome: record.outcome,
          url: record.url,
          winner: record.winner || "undefined",
        }
      }
    ], function (err, records) {
      if (err) {
        reject(new Error(err.message || String(err)));
        return;
      }
      if (records && records.length > 0) {
        resolve(records[0].getId());
      } else {
        reject(new Error('No records created'));
      }
    });
  });
}

/**
 * Update winner for a record
 */
export function updateWinner(table: string, airtableRecordId: string, winner: string): Promise<void> {
  return new Promise((resolve, reject) => {
    base(table).update([
      {
        id: airtableRecordId,
        fields: {
          winner: winner,
        }
      }
    ], function (err) {
      if (err) {
        reject(new Error(err.message || String(err)));
        return;
      }
      resolve();
    });
  });
}

/**
 * Get all records from Airtable
 */
export function getAllRecords(table: string): Promise<Array<TradeRecordWithId>> {
  return new Promise((resolve, reject) => {
    const records: Array<TradeRecordWithId> = [];

    base(table).select({
      maxRecords: 1000,
      view: "Grid view"
    }).eachPage(function page(pageRecords, fetchNextPage) {
      pageRecords.forEach(function (record) {
        const fields = record.fields as unknown as TradeRecord;
        records.push({
          airtableId: record.id,
          eventId: fields.eventId,
          coin: fields.coin,
          price: fields.price,
          event: fields.event,
          outcome: fields.outcome,
          url: fields.url,
          winner: fields.winner
        });
      });
      fetchNextPage();
    }, function done(err) {
      if (err) {
        reject(new Error(err.message || String(err)));
        return;
      }
      resolve(records);
    });
  });
}

/**
 * Save outcome count to Table 2 - increment Up or Down count
 */
export function saveOutcomeCount(table: string, eventId: string, outcome: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // First, find the existing record
    base(table).select({
      filterByFormula: `{eventId} = '${eventId}'`,
      maxRecords: 1
    }).firstPage(function (err, records) {
      if (err) {
        reject(new Error(err.message || String(err)));
        return;
      }

      if (records && records.length > 0) {
        // Update existing record by incrementing the count
        const record = records[0];
        const currentUp = (record.get('Up') as number) || 0;
        const currentDown = (record.get('Down') as number) || 0;

        const newUp = outcome === 'Up' ? currentUp + 1 : currentUp;
        const newDown = outcome === 'Down' ? currentDown + 1 : currentDown;

        base(table).update([
          {
            id: record.id,
            fields: {
              Up: newUp,
              Down: newDown
            }
          }
        ], function (err, updatedRecords) {
          if (err) {
            reject(new Error(err.message || String(err)));
            return;
          }
          if (updatedRecords && updatedRecords.length > 0) {
            resolve(updatedRecords[0].getId());
          } else {
            reject(new Error('No records updated'));
          }
        });
      } else {
        reject(new Error(`No record found with eventId: ${eventId}`));
      }
    });
  });
}

/**
 * Creates and saves record to Airtable
 */
export const saveToAirtable = async (id: string, eventSlug: string, outcome: string, price: number): Promise<void> => {
    const record = {
        eventId: id,
        coin: extractCoinFromEvent(eventSlug) ?? "Unknown",
        price: price,
        event: eventSlug,
        outcome: outcome,
        url: `https://polymarket.com/event/${eventSlug}`,
        winner: "Undefined"
    };

    try {
        const recordId = await createRecord("Table 1", record);
        airtableLogger.info("Created initial record with counts: {recordId}", { recordId });
    } catch (error) {
        airtableLogger.error("Failed to create initial record: {error}", {
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
