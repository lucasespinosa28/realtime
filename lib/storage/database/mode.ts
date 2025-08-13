export interface Order {
    timestamp: number;
    price: number;
    size: number;
    side: string;
    outcome: string;
}

export interface Trade {
    timestamp: number
    price: number;
    size: number;
    side: string;
}


export interface DatabaseRecord {
    id: string;
    title: string;
    order?: Order[];
    Up?: {
        assetId: string,
        trades: Trade[]
    }
    Down?: {
        assetId: string,
        trades: Trade[]
    }
}
