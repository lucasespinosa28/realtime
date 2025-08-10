export interface TradeRecord {
  eventId: string;
  coin: string;
  price: number;
  event: string;
  assetId: string;
  outcome: string;
  asksSize: number;
  bidsSize: number;
  url: string;
  winner: string;
  lowest: number;
}

export interface TradeRecordWithId extends TradeRecord {
  airtableId: string;
  created: string;
}
