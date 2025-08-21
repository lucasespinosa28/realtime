export interface Trade {
    asset: string;
    outcome: string;
    conditionId: string;
    price: number;
    size: number;
    side: string;
    timestamp: number;
    bio: string;
    eventSlug: string;
    icon: string;
    name: string;
    outcomeIndex: number;
    profileImage: string;
    proxyWallet: string;
    pseudonym: string;
    slug: string;
    title: string;
    transactionHash: string;
}

export interface Buy {
    asset: string;
    conditionId: string;
    price: number;
    size: number;
    side: "BUY";
    timestamp: number;
}

export interface Sell {
    asset: string;
    conditionId: string;
    price: number;
    size: number;
    side: "SELL";
    timestamp: number;
}

export interface Market {
    enable_order_book: boolean;
    active: boolean;
    closed: boolean;
    archived: boolean;
    accepting_orders: boolean;
    accepting_order_timestamp: null | string | number;
    minimum_order_size: number;
    minimum_tick_size: number;
    condition_id: string;
    question_id: string;
    question: string;
    description: string;
    market_slug: string;
    end_date_iso: string;
    game_start_time: null | string;
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
        rates: null | string | number;
        min_size: number;
        max_spread: number;
    }
    is_50_50_outcome: boolean;
    tokens: Tokens[];
    tags: string[];
}

export interface Tokens {
    token_id: string;
    outcome: string;
    price: number;
    winner: boolean;
}