import Airtable from "airtable";

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

/**
 * Create a new record in Airtable
 */
export function createRecord(table: string, record: TradeRecord): Promise<string> {
  return new Promise((resolve, reject) => {
    // Set initial counts based on outcome
    const upCount = record.outcome === 'Up' ? 1 : 0;
    const downCount = record.outcome === 'Down' ? 1 : 0;

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
          Up: upCount,
          Down: downCount
        }
      }
    ], function(err, records) {
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
export function updateWinner(table:string, airtableRecordId: string, winner: string): Promise<void> {
  return new Promise((resolve, reject) => {
    base(table).update([
      {
        id: airtableRecordId,
        fields: {
          winner: winner,
        }
      }
    ], function (err, records) {
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
export function getAllRecords(table:string): Promise<Array<{airtableId: string, conditionId: string}>> {
  return new Promise((resolve, reject) => {
    const records: Array<{airtableId: string, conditionId: string}> = [];

    base(table).select({
      maxRecords: 1000,
      view: "Grid view"
    }).eachPage(function page(pageRecords, fetchNextPage) {
      pageRecords.forEach(function (record) {
        const conditionId = record.get('id');
        if (typeof conditionId === 'string') {
          records.push({
            airtableId: record.id,
            conditionId: conditionId
          });
        }
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
      filterByFormula: `{id} = '${eventId}'`,
      maxRecords: 1
    }).firstPage(function(err, records) {
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
        ], function(err, updatedRecords) {
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
