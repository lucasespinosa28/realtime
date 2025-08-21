import { instructions } from "./config";
import { shouldProcessMessage } from "./lib/processing";
import { DatabaseManager } from "./lib/storage/database";
import { logger, storage } from "./lib/storage/memory";
import { getBook, polymarket, postOrder, priceHandler } from "./lib/trading";
import { RealTimeDataClient } from "./lib/websocket";
import type { Message } from "./lib/websocket/model";
import { appLogger, configureLogging } from "./utils/logger";

const database = new DatabaseManager("trades4.sqlite");
// In-memory set of assets we've already bought (authoritative copy in DB)
const boughtAssets = new Set<string>();
// Track which conditionIds we've already placed orders for
const processedConditionIds = new Set<string>();
// New: guard concurrent processing per conditionId
const inFlightConditionIds = new Set<string>();

// Constants for trading rules
const TRADING_RULES = {
    START_TIME: 45,
    BUY_PRICE_THRESHOLD: 0.90,
    MIN_BID_PRICE: 0.89,
} as const;

// Types for better clarity
interface TradeData {
    conditionId: string;
    asset: string;
    title: string;
    outcome: string;
    price: number;
    timestamp: number;
    side: string;
    size: number;
}


/**
 * Checks if a placed buy order has been matched
 */
async function checkOrderStatus(conditionId: string, asset: string, outcome: string, tradeData: TradeData): Promise<void> {
    if (!storage.hasId(asset)) return; // nothing to check
    const storedOrder = storage.get(asset);
    // Skip if already matched or outcome doesn't match
    if (storedOrder.status === "MATCHED" || storedOrder.outcome !== outcome) {
        return;
    }
    const orderId = storedOrder.orderID;
    if (!orderId) {
        return;
    }
    try {
        const order = await polymarket.getOrder(orderId);
        if (order.status === "MATCHED") {
            appLogger.info("Buy order matched for condition {conditionId} outcome {outcome}", {
                conditionId: tradeData.title,
                outcome
            });
            // Update storage with matched status
            storage.add(asset, {
                orderID: orderId,
                asset: asset,
                outcome: outcome,
                status: "MATCHED",
                conditionId: conditionId
            });
        }
    } catch (error) {
        appLogger.error("Error checking order status for {conditionId}: {error}", {
            conditionId: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

/**
 * Places a buy order for a given asset
 */
async function placeBuyOrder(tradeData: TradeData): Promise<boolean> {
    try {
        // Check if we already processed this condition
        if (processedConditionIds.has(tradeData.conditionId)) {
            // Only log the first time we see this conditionId
            if (!logger.get(`logged:${tradeData.conditionId}`)) {
                appLogger.info("Order already placed for condition {title} — skipping post for asset {asset}", {
                    title: tradeData.title,
                    asset: tradeData.asset
                });
                logger.add(`logged:${tradeData.conditionId}`, true);
            }
            return true;
        }

        // Double-check idempotency: if memory already contains a buy for this asset, skip
        if (boughtAssets.has(tradeData.asset)) {
            appLogger.info("Buy already recorded in DB for asset {asset} — skipping post", { asset: tradeData.asset });
            return true;
        }

        const calculatedPrice = priceHandler(tradeData.price);
        appLogger.info("Calculated price for {title}: {originalPrice} -> {calculatedPrice}", {
            title: tradeData.title,
            originalPrice: tradeData.price,
            calculatedPrice: calculatedPrice
        });

        const order = await postOrder(
            tradeData.asset,
            calculatedPrice,
            tradeData.size,
        );
        if (order.success) {
            // Track in memory to avoid future DB checks
            boughtAssets.add(tradeData.asset);
            // Mark this conditionId as processed
            processedConditionIds.add(tradeData.conditionId);
            // Update storage with order details
            storage.add(tradeData.asset, {
                orderID: order.orderID,
                asset: tradeData.asset,
                outcome: tradeData.outcome,
                status: order.status,
                conditionId: tradeData.conditionId
            });
            appLogger.info("Buy order placed for {title} at price {price} asset {outcome}, conditionId {conditionId}", {
                title: tradeData.title,
                price: priceHandler(tradeData.price),
                outcome: tradeData.outcome,
                conditionId: tradeData.conditionId
            });
            return true;
        } else {
            // Mark as failed
            storage.add(tradeData.asset, {
                orderID: "",
                asset: tradeData.asset,
                outcome: tradeData.outcome,
                status: "failed",
                conditionId: tradeData.conditionId
            });
            appLogger.warn("Buy order failed for {title} asset {asset}", { title: tradeData.title, asset: tradeData.asset });
            return false;
        }
    } catch (error) {
        appLogger.error("Error placing buy order for {title}: {error}", {
            title: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
        // Clean up processing status on error to allow retry
        storage.delete(tradeData.asset);
        return false;
    }
}

/**
 * Executes buy logic when conditions are met
 */
async function executeBuyLogic(tradeData: TradeData): Promise<void> {
    try {
        // Check order book for sufficient liquidity
        const book = await getBook(tradeData.asset);
        if (!book.asks.length || !book.bids.length) {
            appLogger.warn("No liquidity available for {title}", { title: tradeData.title });
            // Remove processing status since we can't proceed
            storage.delete(tradeData.asset);
            return;
        }
        // Check if bid price meets minimum requirement
        const highestBidPrice = parseFloat(book.bids[book.bids.length - 1].price);
        if (highestBidPrice < TRADING_RULES.MIN_BID_PRICE) {
            appLogger.info("Bid price {bidPrice} too low (< {minBid}) for {title}", {
                bidPrice: highestBidPrice,
                minBid: TRADING_RULES.MIN_BID_PRICE,
                title: tradeData.title
            });
            // Remove processing status since we can't proceed
            storage.delete(tradeData.asset);
            return;
        }
        // Asset is already marked as "processing" from the caller
        await placeBuyOrder(tradeData);
    } catch (error) {
        appLogger.error("Error in buy logic for {title}: {error}", {
            title: tradeData.title,
            error: error instanceof Error ? error.message : String(error)
        });
        // Remove processing status on error
        storage.delete(tradeData.asset);
    }
}

/**
 * Simulate a buy order (no API call).
 */
function simulateBuyOrder(tradeData: TradeData): void {
    boughtAssets.add(tradeData.asset);
    processedConditionIds.add(tradeData.conditionId);
    storage.add(tradeData.asset, {
        orderID: "SIMULATED",
        asset: tradeData.asset,
        outcome: tradeData.outcome,
        status: "filled",
        conditionId: tradeData.conditionId
    });
    appLogger.info("Simulated buy order placed for {title} at price {price} asset {outcome} conditionId {conditionId}", {
        title: tradeData.title,
        conditionId: tradeData.conditionId,
        price: tradeData.price,
        outcome: tradeData.outcome,
    });
}

/**
 * Main message handler for trade events
 */
async function handleTradeMessage(message: Message): Promise<void> {
     const currentMinutes = new Date().getMinutes();
    for (const instruction of instructions) {
        if (!shouldProcessMessage(message, instruction.slug)) {
            continue;
        }

        const tradeData: TradeData = {
            conditionId: message.payload.conditionId,
            asset: message.payload.asset,
            title: message.payload.title,
            outcome: message.payload.outcome,
            price: message.payload.price,
            timestamp: message.payload.timestamp,
            side: message.payload.side,
            size: instruction.size
        };

        // If this event is "bitcoin" and price is 0.05, simulate a buy and skip normal flow
        const isBitcoinEvent =
            (message.payload.eventSlug?.toLowerCase().includes("bitcoin") ?? false) ||
            (tradeData.title?.toLowerCase().includes("bitcoin") ?? false);

        if (isBitcoinEvent && tradeData.price === 0.05) {
            if (
                processedConditionIds.has(tradeData.conditionId) ||
                inFlightConditionIds.has(tradeData.conditionId) ||
                boughtAssets.has(tradeData.asset)
            ) {
                continue;
            }
            inFlightConditionIds.add(tradeData.conditionId);
            try {
                simulateBuyOrder(tradeData);
            } finally {
                inFlightConditionIds.delete(tradeData.conditionId);
            }
            continue;
        }

        // Move jump check after tradeData init so simulation can run
        if (message.payload.eventSlug.includes(instruction.jump)) {
            if (!logger.get(`logged:${message.payload.eventSlug}`)) {
                appLogger.info("Order jumped {jump}", {
                    jump: message.payload.eventSlug
                });
                logger.add(`logged:${message.payload.eventSlug}`, true);
            }
            return;
        }

        // setOppositeSide(tradeData);
        // Record all trades in database
        database.setTrade({
            asset: tradeData.asset,
            conditionId: tradeData.conditionId,
            outcome: tradeData.outcome,
            price: tradeData.price,
            size: message.payload.size,
            side: tradeData.side,
            timestamp: tradeData.timestamp,
            bio: message.payload.bio,
            eventSlug: message.payload.eventSlug,
            icon: message.payload.icon,
            name: message.payload.name,
            outcomeIndex: message.payload.outcomeIndex,
            profileImage: message.payload.profileImage,
            proxyWallet: message.payload.proxyWallet,
            pseudonym: message.payload.pseudonym,
            slug: message.payload.slug,
            title: message.payload.title,
            transactionHash: message.payload.transactionHash
        });
        // 1. Always check if we have an existing order and update its status
        if (storage.hasId(tradeData.asset)) {
            const storedOrder = storage.get(tradeData.asset);
            await checkOrderStatus(tradeData.conditionId, storedOrder.asset, tradeData.outcome, tradeData);
        }
        const withinBuyWindow = TRADING_RULES.START_TIME < currentMinutes;
        if (withinBuyWindow) {
            if (tradeData.price >= TRADING_RULES.BUY_PRICE_THRESHOLD) {
                // Skip if already processed, claimed, or asset already bought
                if (
                    processedConditionIds.has(tradeData.conditionId) ||
                    inFlightConditionIds.has(tradeData.conditionId) ||
                    boughtAssets.has(tradeData.asset)
                ) {
                    continue;
                }

                // Claim this conditionId to prevent duplicate processing
                inFlightConditionIds.add(tradeData.conditionId);

                // Mark processing for visibility
                storage.add(tradeData.asset, {
                    orderID: "",
                    asset: tradeData.asset,
                    outcome: tradeData.outcome,
                    status: "processing",
                    conditionId: tradeData.conditionId
                });

                try {
                    await executeBuyLogic(tradeData);
                } finally {
                    // Always release the claim so future retries are possible if not processed
                    inFlightConditionIds.delete(tradeData.conditionId);
                }
            }
        }
    }
}

/**
 * WebSocket event handlers
 */
const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    await handleTradeMessage(message);
};

const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

const onConnect = (client: RealTimeDataClient): void => {
    client.subscribe({
        subscriptions: [
            {
                topic: "activity",
                type: "trades",
            },
        ],
    });
    appLogger.info("Connected to Polymarket WebSocket and subscribed to trades");
};

/**
 * Application entry point
 */
async function main(): Promise<void> {
    await configureLogging();
    appLogger.info("Starting Polymarket Realtime Trading Bot...");
    appLogger.info("Trading Rules: Buy > {buyThreshold}", {
        buyThreshold: TRADING_RULES.BUY_PRICE_THRESHOLD,
    });
    new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();
}

main().catch(console.error);