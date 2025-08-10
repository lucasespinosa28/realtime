export interface TradeRecord {
  eventId: string;
  coin: string;
  price: number;
  event: string;
  assetId: string;
  outcome: string;
  url: string;
  winner: string;
  buyed: boolean;
}

export interface TradeRecordWithId extends TradeRecord {
  airtableId: string;
  created: string;
}
