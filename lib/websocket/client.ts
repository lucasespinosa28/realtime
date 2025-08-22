import type { SubscriptionMessage, Message } from "./model";
import { ConnectionStatus } from "./model";
import { websocketLogger } from "../../utils/logger";

const DEFAULT_HOST = "wss://ws-live-data.polymarket.com";
const DEFAULT_PING_INTERVAL = 5000;

/**
 * Interface representing the arguments for initializing a RealTimeDataClient.
 */
export interface RealTimeDataClientArgs {
    /**
     * Optional callback function that is called when the client successfully connects.
     * @param client - The instance of the RealTimeDataClient that has connected.
     */
    onConnect?: (client: RealTimeDataClient) => void;

    /**
     * Optional callback function that is called when the client receives a message.
     * @param client - The instance of the RealTimeDataClient that received the message.
     * @param message - The message received by the client.
     */
    onMessage?: (client: RealTimeDataClient, message: Message) => void;

    /**
     * Optional callback function that is called when the client receives a connection status update.
     * @param status - The connection status of the client.
     */
    onStatusChange?: (status: ConnectionStatus) => void;

    /**
     * Optional host address to connect to.
     */
    host?: string;

    /**
     * Optional interval in milliseconds for sending ping messages to keep the connection alive.
     */
    pingInterval?: number;

    /**
     * Optional flag to enable or disable automatic reconnection when the connection is lost.
     */
    autoReconnect?: boolean;
}

/**
 * A client for managing real-time WebSocket connections, handling messages, subscriptions,
 * and automatic reconnections.
 */
export class RealTimeDataClient {
    /** WebSocket server host URL */
    private readonly host: string;

    /** Interval (in milliseconds) for sending ping messages */
    private readonly pingInterval: number;

    /** Determines whether the client should automatically reconnect on disconnection */
    private autoReconnect: boolean;

    /** Callback function executed when the connection is established */
    private readonly onConnect?: (client: RealTimeDataClient) => void;

    /** Callback function executed when a custom message is received */
    private readonly onCustomMessage?: (client: RealTimeDataClient, message: Message) => void;

    /** Callback function executed on a connection status update */
    private readonly onStatusChange?: (status: ConnectionStatus) => void;

    /** WebSocket instance */
    private ws!: WebSocket;

    /** Ping timeout reference for cleanup */
    private pingTimeout?: NodeJS.Timeout;

    /** Reconnection attempt counter */
    private reconnectAttempts: number = 0;

    /** Maximum reconnection attempts */
    private readonly maxReconnectAttempts: number = 10;

    /**
     * Constructs a new RealTimeDataClient instance.
     * @param args Configuration options for the client.
     */
    constructor(args?: RealTimeDataClientArgs) {
        this.host = args!.host || DEFAULT_HOST;
        this.pingInterval = args!.pingInterval || DEFAULT_PING_INTERVAL;
        this.autoReconnect = args!.autoReconnect || true;
    this.onCustomMessage = args!.onMessage;
        this.onConnect = args!.onConnect;
        this.onStatusChange = args!.onStatusChange;
    }

    /**
     * Establishes a WebSocket connection to the server.
     */
    public connect() {
        // Clean up existing connection if any
        if (this.ws) {
            this.cleanup();
        }

        this.notifyStatusChange(ConnectionStatus.CONNECTING);
        this.ws = new WebSocket(this.host);
        if (this.ws) {
            this.ws.onopen = this.onOpen;
            this.ws.onmessage = this.onMessage;
            this.ws.onclose = this.onClose;
            this.ws.onerror = this.onError;
        }
        return this;
    }

    /**
     * Clean up WebSocket connection and timers
     */
    private cleanup() {
        if (this.pingTimeout) {
            clearTimeout(this.pingTimeout);
            this.pingTimeout = undefined;
        }
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.close();
            }
        }
    }

    /**
     * Handles WebSocket 'open' event. Executes the `onConnect` callback and starts pinging.
     */
    private onOpen = async () => {
        this.reconnectAttempts = 0; // Reset reconnection counter
        this.ping();
        this.notifyStatusChange(ConnectionStatus.CONNECTED);
        if (this.onConnect) {
            this.onConnect(this);
        }
    };

    /**
     * Handles WebSocket errors. Logs the error and attempts reconnection if `autoReconnect` is enabled.
     * @param err Error object describing the issue.
     */
    private onError = () => {
        websocketLogger.error("WebSocket error occurred");
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
            setTimeout(() => this.connect(), delay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            websocketLogger.error("Max reconnection attempts reached. Stopping reconnection.");
            this.autoReconnect = false;
        }
    };

    /**
     * Handles WebSocket 'close' event. Logs the disconnect reason and attempts reconnection if `autoReconnect` is enabled.
     * @param code Close event code.
     * @param reason Buffer containing the reason for closure.
     */
    private onClose = async (message: CloseEvent) => {
        websocketLogger.warning("WebSocket disconnected - code: {code} reason: {reason}", {
            code: message.code,
            reason: message.reason
        });
        this.notifyStatusChange(ConnectionStatus.DISCONNECTED);
        this.cleanup();
        
        if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff
            setTimeout(() => this.connect(), delay);
        }
    };

    /**
     * Sends a ping message to keep the connection alive.
     */
    private ping = async () => {
        if (this.ws.readyState !== WebSocket.OPEN) {
            return websocketLogger.warning("Socket not open. Ready state is: {readyState}", { 
                readyState: this.ws.readyState 
            });
        }
        this.ws.send("ping");
    };

    /**
     * Handles incoming WebSocket messages. Parses and processes custom messages if applicable.
     * @param event Raw WebSocket message data.
     */
    private onMessage = (event: MessageEvent): void => {
        try {
            if (typeof event.data === "string" && event.data.length > 0) {
                if (this.onCustomMessage) {
                    const message = JSON.parse(event.data);
                    if (message && typeof message === 'object' && 'payload' in message) {
                        this.onCustomMessage(this, message as Message);
                    }
                }
            }
        } catch (error) {
            websocketLogger.error("Error parsing message: {error}", {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    };

    /**
     * Closes the WebSocket connection.
     */
    public disconnect() {
        this.autoReconnect = false;
        this.cleanup();
    }

    /**
     * Subscribes to a data stream by sending a subscription message.
     * @param msg Subscription request message.
     */
    public subscribe(msg: SubscriptionMessage) {
        if (this.ws.readyState !== WebSocket.OPEN) {
            return websocketLogger.warning("Socket not open. Ready state is: {readyState}", { 
                readyState: this.ws.readyState 
            });
        }
        this.ws.send(JSON.stringify({ action: "subscribe", ...msg }));
    }

    /**
     * Unsubscribes from a data stream by sending an unsubscription message.
     * @param msg Unsubscription request message.
     */
    public unsubscribe(msg: SubscriptionMessage) {
        if (this.ws.readyState !== WebSocket.OPEN) {
            return websocketLogger.warning("Socket not open. Ready state is: {readyState}", { 
                readyState: this.ws.readyState 
            });
        }
        websocketLogger.debug("Unsubscribing from: {topic}", { topic: msg.subscriptions[0]?.topic });
        this.ws.send(JSON.stringify({ action: "unsubscribe", ...msg }));
    }

    /**
     * Callback for connection status changes
     * @param status status of the connection
     */
    private notifyStatusChange(status: ConnectionStatus) {
        if (this.onStatusChange) {
            this.onStatusChange(status);
        }
        return status;
    }
}

// function delay(ms: number) {
//     return new Promise(resolve => setTimeout(resolve, ms));
// }