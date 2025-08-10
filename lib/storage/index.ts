import Airtable from "airtable";
import type { TradeRecord, TradeRecordWithId } from "./types";


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
          assetId: record.assetId,
          outcome: record.outcome,
          url: record.url,
          winner: record.winner || "undefined",
          asksSize: record.asksSize,
          bidsSize: record.bidsSize,
          lowest: record.lowest
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
 * Update lowest for a record
 */
export function updateLowest(table: string, airtableRecordId: string, lowest: number): Promise<void> {
  return new Promise((resolve, reject) => {
    base(table).update([
      {
        id: airtableRecordId,
        fields: {
          lowest: lowest,
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
 * Get lowest for a record
 */
export function getLowest(table: string, airtableRecordId: string): Promise<number | undefined> {
  return new Promise((resolve, reject) => {
    base(table).find(airtableRecordId, function (err, record) {
      if (err) {
        reject(new Error(err.message || String(err)));
        return;
      }
      if (!record) {
        resolve(undefined);
        return;
      }
      const fields = record.fields as unknown as TradeRecord;
      resolve(fields.lowest);
    });
  });
}

/**
 * Get record data including lowest and outcome
 */
export function getRecordData(table: string, airtableRecordId: string): Promise<{ lowest: number; outcome: string } | undefined> {
  return new Promise((resolve, reject) => {
    base(table).find(airtableRecordId, function (err, record) {
      if (err) {
        reject(new Error(err.message || String(err)));
        return;
      }
      if (!record) {
        resolve(undefined);
        return;
      }
      const fields = record.fields as unknown as TradeRecord;
      resolve({
        lowest: fields.lowest,
        outcome: fields.outcome
      });
    });
  });
}

/**
 * Update lowest for a record using eventId
 */
export async function updateLowestByEventId(table: string, eventId: string, lowest: number): Promise<void> {
  const records = await getAllRecords(table);
  const found = records.find(r => r.eventId === eventId);
  if (!found) {
    throw new Error(`No record found with eventId: ${eventId}`);
  }
  return updateLowest(table, found.airtableId, lowest);
}

/**
 * Update assetId, asksSize, and bidsSize for a record
 */
export function updateAssetAndSizes(
  table: string,
  airtableRecordId: string,
  assetId: string,
  asksSize: number,
  bidsSize: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    base(table).update([
      {
        id: airtableRecordId,
        fields: {
          assetId,
          asksSize,
          bidsSize,
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
          assetId: fields.assetId,
          outcome: fields.outcome,
          asksSize: fields.asksSize,
          bidsSize: fields.bidsSize,
          url: fields.url,
          winner: fields.winner,
          created: String(record.get("Created") ?? ""),
          lowest: fields.lowest
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

