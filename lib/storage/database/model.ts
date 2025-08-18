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