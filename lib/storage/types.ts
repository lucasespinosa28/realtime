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


export interface DatabaseRecord {
  id: string;
  title: string;
  order?: Order;
  up?: {
    assetId: string,
    trades: Trade[]
  }
  down?: {
    assetId: string,
    trades: Trade[]
  }
}

export interface Order {
  timestamp: number;
  price: number;
  size: number;
  side: string;
}

export interface Trade {
  timestamp: number
  price: number;
  size: number;
  side: string;
}