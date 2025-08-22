export interface Order {
    asset: string;
    orderID: string;
    outcome: string;
    status: string;
    conditionId: string;
}

export interface TradeOrder {
    asset: string;
    orderID: string;
    status: string;
    conditionId: string;
}