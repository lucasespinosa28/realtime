export interface Trade {
    asset: string;
    outcome: string;
    conditionId: string;
    price: number;
    size: number;
    side: string;
    timestamp: number;
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