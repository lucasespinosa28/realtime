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

export interface Token {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface Rewards {
  tokens: {
    rates: null;
    min_size: number;
    max_spread: number;
  };
}

export interface FullMarketRecord {
  id: string;
  title: string;
  enable_order_book: boolean;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  accepting_order_timestamp: number | null;
  minimum_order_size: number;
  minimum_tick_size: number;
  condition_id: string;
  question_id: string;
  question: string;
  description: string;
  market_slug: string;
  end_date_iso: string;
  game_start_time: string | null;
  seconds_delay: number;
  fpmm: string;
  maker_base_fee: number;
  taker_base_fee: number;
  notifications_enabled: boolean;
  neg_risk: boolean;
  neg_risk_market_id: string;
  neg_risk_request_id: string;
  icon: string;
  image: string;
  rewards: Rewards;
  is_50_50_outcome: boolean;
  tokens: Token[];
  tags: string[];
}