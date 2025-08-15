import { instructions } from "./config";
import { shouldProcessMessage } from "./lib/processing";
import { DatabaseManager } from "./lib/storage/database";
import { eventsTokens, handleId, storage } from "./lib/storage/memory";
import { getBook, polymarket, postOrder, priceHandler, sellOrder } from "./lib/trading";
import { RealTimeDataClient } from "./lib/websocket";
import type { Message } from "./lib/websocket/model";
import { appLogger, configureLogging } from "./utils/logger";


const database = new DatabaseManager();

const updateOrder = async (id: string, tokenId: string, outcome: string,timestamp:number,marketId:string) => {
    const storedOrder = storage.get(id);

    // Skip if order is already matched or if outcome doesn't match
    if (storedOrder.status === "MATCHED" || storedOrder.outcome !== outcome) {
        return;
    }

    const orderId = storedOrder.orderID;
    // Only call getOrder if we have a valid orderID and status is not already MATCHED
    if (orderId && orderId !== "") {
        const order = await polymarket.getOrder(orderId);
        if (order.status === "MATCHED") {
            appLogger.info("Order {orderId} for asset {id} matched with outcome {outcome}", {
                orderId,
                id,
                outcome
            });
            database.setBuy({
                id: tokenId,
                market: marketId,
                price: Number(order.price),
                size: Number(order.size_matched),
                side: "BUY",
                timestamp: timestamp
            })
            // Update storage with matched status to avoid future getOrder calls
            storage.add(id, { orderID: orderId, asset: tokenId, outcome: outcome, status: "MATCHED" });
        }
    }
}


const buyOrder = async (id: string, tokenId: string, price: number, size: number, title: string, outcome: string) => {
    const order = await postOrder(tokenId, price, size, title, outcome);
    // Update storage with the actual order details (overwriting the "processing" status)
    if (order.success) {
        storage.add(id, { orderID: order.orderID, asset: tokenId, outcome: outcome, status: order.status });
        appLogger.info("Order successfully placed for asset {id} title: {title}", { id, title });
    } else {
        storage.add(id, { orderID: "", asset: tokenId, outcome: outcome, status: "failed" });
        appLogger.warn("Order placement failed for asset  {id} title: {title}", { id, title });
    }
}

const handleBuy = async (id: string, tokenId: string, price: number, size: number, minutes: number, title: string, outcome: string) => {
    const book = await getBook(tokenId);
    if (!book.asks.length || !book.bids.length) {
        appLogger.warn(`Order not placed: empty asks or bids for tokenId ${tokenId} title: ${title}`);
        return; // Exit instruction loop since we processed this message
    }
    const bidPrice = parseFloat(book.bids.reverse()[0].price);
    if (bidPrice >= 0.88) {
        try {

            await buyOrder(id, tokenId, priceHandler(price), size, title, outcome)
        } catch (error) {
            appLogger.error("Error placing order for asset {id}: {error} title: {title}", {
                id,
                title,
                error: error instanceof Error ? error.message : String(error)
            });
        }
        return; // Exit instruction loop since we successfully processed this message
    } else {
        // Bid price too low, mark as failed (will retry if bid price improves)
        appLogger.info("Bid price {bidPrice} too low (< 0.88) for asset {id} title: {title}", { bidPrice, id, title });
        return; // Exit instruction loop since we processed this message
    }
}

const handleSell = async (id: string, tokenId: string, outcome: string, title: string, minutes: number, size: number, price: number, marketId:string,timestamp:number) => {
    // Debug: Log the price value being checked

    const buyOrder = storage.get(handleId("buy", id));
    if (!buyOrder) {
        appLogger.warn("No buy order found for asset {id}, cannot sell", { id });
        return;
    }

    if (buyOrder.status !== "MATCHED") {
        appLogger.info("Buy order status is {status}, not MATCHED, skipping sell for asset {id}", { status: buyOrder.status, id });
        return;
    }

    // Check if price dropped below 0.51 and current time has minutes > 55
    if (price < 0.51 && minutes > 55) {
        try {
            if (!storage.hasId(handleId("sell", id))) {
                const sellOrderResult = await sellOrder(tokenId, size, title, outcome);
                if (sellOrderResult.success) {
                    database.setSell({
                        id: tokenId,
                        market: marketId,
                        price: price,
                        size: size,
                        side: "SELL",
                        timestamp: timestamp
                    })
                    appLogger.info("STOP LOSS: Sell order placed for asset {id} at price {price} (minutes: {minutes}) title: {title}", { id, price, minutes, title });
                    // Update storage to reflect sell order - this prevents any future selling for this asset
                    storage.add(handleId("sell", id), { orderID: sellOrderResult.orderID, asset: tokenId, outcome: outcome, status: "SOLD" });
                } else {
                    appLogger.warn("Sell order failed for asset {id} title: {title}", { id, title });
                }
            } else {
                appLogger.info("Sell order already exists for asset {id}", { id });
            }
        } catch (error) {
            appLogger.error("Error placing STOP LOSS sell order for asset {id}: {error} title: {title}", {
                id,
                title,
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}

// const lastBuy = async () => {
//     for (let index = 0; index < eventsTokens.length; index++) {
//         const token = eventsTokens[index];

//         // Check if we already processed this token
//         if (temp.includes(token)) {
//             appLogger.info("Token {token} already processed, skipping", { token });
//             continue;
//         }

//         const book = await getBook(token);
//         if (!book.asks.length || !book.bids.length) {
//             appLogger.warn(`Order not placed: empty asks or bids for tokenId ${token}`);
//             continue; // Continue to next token instead of returning
//         }
//         const askPrice = parseFloat(book.asks.reverse()[0].price);
//         const order: Order = await polymarket.createAndPostOrder(
//             {
//                 tokenID: token,
//                 price: askPrice,
//                 side: Side.BUY,
//                 size: 5,
//                 feeRateBps: 0,
//             },
//             { tickSize: "0.01", negRisk: false },
//             OrderType.GTC
//         );
//         if (order.success) {
//             appLogger.info("Order successfully placed for {token}", { token });
//             // Add to temp array to prevent duplicate orders
//             temp.push(token);
//         } else {
//             appLogger.warn("Order placement failed for {token}", { token });
//         }
//     }
//     eventsTokens.length = 0;
// }

const onMessage = async (_client: RealTimeDataClient, message: Message): Promise<void> => {
    for (const instruction of instructions) {
        if (!shouldProcessMessage(message, instruction.slug)) {
            continue;
        }
        const id = message.payload.asset;
        const marketId = message.payload.conditionId;    
        const title = message.payload.title;
        const outcome = message.payload.outcome;
        const tokenId = message.payload.asset;
        const price = message.payload.price;
        const timestamp = message.payload.timestamp;
        const side = message.payload.side;
        const minutes = new Date().getMinutes();

       
        database.setTrade({
            id,
            outcome,
            market: tokenId,
            price,
            size: instruction.size,
            side,
            timestamp
        });

        if (storage.hasId(handleId("buy", id))) {
            await updateOrder(handleId("buy", id), tokenId, outcome, timestamp, marketId);

        }
        // Only check sell conditions if we have a matched buy order
        if (storage.hasId(handleId("buy", id)) && storage.get(handleId("buy", id)).status === "MATCHED") {
            await handleSell(id, tokenId, outcome, title, minutes, instruction.size, price, marketId, timestamp);

        }
        if (price > 0.90 && !storage.hasId(handleId("buy", id)) && minutes > 30) {
            // Mark as processing immediately to prevent duplicate orders
            storage.add(handleId("buy", id), { orderID: "", asset: tokenId, outcome: outcome, status: "processing" });
            await handleBuy(handleId("buy", id), tokenId, price, instruction.size, minutes, title, outcome)

        }
        if (price > 95 && minutes == 59) {
            eventsTokens.push(tokenId)
        }
    }

}

const onStatusChange = (status: string) => {
    appLogger.info("WebSocket status changed: {status}", { status });
};

const onConnect = (client: RealTimeDataClient): void => {
    // Subscribe to a topic
    client.subscribe({
        subscriptions: [
            {
                topic: "activity",
                type: "trades",
            },
        ],
    });
};

// const lasted = async () => {
//     const currentTime = new Date();
//     const minutes = currentTime.getMinutes();
//     if (minutes === 59) {
//         await lastBuy();
//     }
// }


// Start the WebSocket client
const main = async () => {
    await configureLogging();
    appLogger.info("Starting Polymarket Realtime Monitor...");
    // setInterval(async () => {
    //     await lasted();
    // }, 250);
    new RealTimeDataClient({ onMessage, onConnect, onStatusChange }).connect();
};

main().catch(console.error);