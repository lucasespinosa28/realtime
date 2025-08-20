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

/**
 * Represents a real-time message received from the WebSocket server.
 */
export interface Message {
    /** Topic of the message */
    topic: string;

    /** Type of the message */
    type: string;

    /** Timestamp of when the message was sent */
    timestamp: number;

    /** Payload containing the message data */
    payload: {
        asset: string;
        bio: string;
        conditionId: string;
        eventSlug: string;
        icon: string;
        name: string;
        outcome: string;
        outcomeIndex: number;
        price: number;
        profileImage: string;
        proxyWallet: string;
        pseudonym: string;
        side: string;
        size: number;
        slug: string;
        timestamp: number;
        title: string;
        transactionHash: string;
    };

    /** Connection ID */
    connection_id: string;
}


export interface OrderBook {
    connection_id: string;
    payload: Payload[] | Payload;
    timestamp: number;
    topic: string;
    type: string;
}


export interface Payload {
    market: string;
    asset_id: string;
    timestamp: string;
    hash: string;
    bids: Book[];
    asks: Book[];
    min_order_size: string;
    tick_size: string;
    neg_risk: boolean;
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