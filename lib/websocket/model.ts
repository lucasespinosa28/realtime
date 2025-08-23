/**
 * API key credentials for CLOB authentication.
 */
export interface ClobApiKeyCreds {
    /** API key used for authentication */
    key: string;

    /** API secret associated with the key */
    secret: string;

    /** Passphrase required for authentication */
    passphrase: string;
}

/**
 * Authentication details for Gamma authentication.
 */
export interface GammaAuth {
    /** Address used for authentication */
    address: string;
}

/**
 * Message structure for subscription requests.
 */
export interface SubscriptionMessage {
    subscriptions: {
        /** Topic to subscribe to */
        topic: string;

        /** Type of subscription */
        type: string;

        /** Optional filters for the subscription */
        filters?: string;

        /** Optional CLOB authentication credentials */
        clob_auth?: ClobApiKeyCreds;

        /** Optional Gamma authentication credentials */
        gamma_auth?: GammaAuth;
    }[];
}

export interface Message {
    connection_id: string;
    payload: Payload;
    timestamp: number;
    topic: string;
    type: string;
}

export interface Payload {
    asks: Book[];
    asset_id: string;
    bids: Book[];
    hash: string;
    market: string;
    min_order_size: string;
    neg_risk: boolean;
    tick_size: string;
    timestamp: string;
}

export interface Book {
    price: string;
    size: string;
}
/**
 * Represents websocket connection status
 */
export enum ConnectionStatus {
    CONNECTING = "CONNECTING",
    CONNECTED = "CONNECTED",
    DISCONNECTED = "DISCONNECTED",
}