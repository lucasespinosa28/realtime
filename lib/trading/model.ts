export interface MarketWinner {
  winner: string;
  isResolved: boolean;
}


export interface MarketToken {
  token_id: string;
  outcome: string;
  price: number;
  winner: boolean;
}

export interface Market {
  enable_order_book: boolean;
  active: boolean;
  closed: boolean;
  archived: boolean;
  accepting_orders: boolean;
  accepting_order_timestamp: string;
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
  rewards: {
    rates: unknown;
    min_size: number;
    max_spread: number;
  };
  is_50_50_outcome: boolean;
  tokens: MarketToken[];
  tags: string[];
}

export interface Order {
  errorMsg: string;
  orderID: string;
  takingAmount: string
  makding: string;
  status: string;
  success: boolean;
}