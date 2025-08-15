export interface Trade {
    id: string;
    outcome: string;
    market: string;
    price: number;
    size: number;
    side: string;
    timestamp: number;
}

export interface Buy {
    id: string;
    market: string;
    price: number;
    size: number;
    side: "BUY";
    timestamp: number;
}

export interface Sell {
    id: string;
    market: string;
    price: number;
    size: number;
    side: "SELL";
    timestamp: number;
}