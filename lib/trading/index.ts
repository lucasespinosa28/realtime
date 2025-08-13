import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { Wallet } from "ethers";
import { polymarketAPILogger } from "../../utils/logger";
import type { MarketWinner, Market, Order } from "./type";
import { manageCacheAndAddId } from "../cache";

const host = 'https://clob.polymarket.com';
const key = process.env.PK;
if (!key) {
  throw new Error('Missing PK environment variable');
}

const address = process.env.PROXY_ADDRESS;
if (!address) {
  throw new Error('Missing PROXY_ADDRESS environment variable');
}

const size = process.env.SIZE;
if (!size) {
  throw new Error('Missing SIZE environment variable');
}

const signer = new Wallet(key);
export const clobClient = new ClobClient(host, 137, signer);
const creds = await clobClient.deriveApiKey();

const clienAuth = new ClobClient(host, 137, signer, creds, 2, address);


/**
 * Get the winner of a market by condition ID
 */
export async function getWinner(conditionId: string): Promise<MarketWinner> {
  try {
    const market = await clobClient.getMarket(conditionId);
    let winner: string = "draw";
    let isResolved = false;

    if (market.tokens[0].winner) {
      winner = market.tokens[0].outcome;
      isResolved = true;
    } else if (market.tokens[1].winner) {
      winner = market.tokens[1].outcome;
      isResolved = true;
    }

    return { winner, isResolved };
  } catch (error) {
    polymarketAPILogger.error("Error getting winner for {conditionId}: {error}", {
      conditionId,
      error: error instanceof Error ? error.message : String(error)
    });
    return { winner: "error", isResolved: false };
  }
}



/**
 * Get market information by condition ID
 */
export async function getMarket(conditionId: string): Promise<Market> {
  try {
    return await clobClient.getMarket(conditionId);
  } catch (error) {
    polymarketAPILogger.error("Error getting market for {conditionId}: {error}", {
      conditionId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function getMarkets(): Promise<Market[]> {
  try {
    const response = await clobClient.getMarkets();
    // Adjust 'data' to the correct property containing the array of markets
    return response.data as Market[];
  } catch (error) {
    polymarketAPILogger.error("Error getting markets: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function placeOrder(asset: string, price: number) {
  // Ensure price has exactly two decimals
  const fixedPrice = Number(price.toFixed(2));
  if (fixedPrice !== price) {
    price = fixedPrice;
  }
  // If price is 0.96, 0.97, 0.98, or 0.99, set price to 0.95
  if ([0.96, 0.97, 0.98, 0.99].includes(price)) {
    price = 0.95;
  }
  if ([0.90, 0.91, 0.92, 0.93, 0.94].includes(price)) {
    price = 0.90;
  }
  try {
    const order:Order = await clienAuth.createAndPostOrder(
      {
        tokenID: asset,
        price: price,
        side: Side.BUY,
        size: Number(size),
        feeRateBps: 0,
      },
      { tickSize: "0.01", negRisk: false },
      OrderType.GTC,
    );

    // Save order ID in cache
    if (order && order.orderID) {
      manageCacheAndAddId(order.orderID);
    }

    polymarketAPILogger.info("Order placed for {asset} at price {price}", {
      asset,
      price
    });

    return order;
  } catch (error) {
    polymarketAPILogger.error("Error placing order for {tokenID}: {error}", {
      asset,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Get book information by asset ID
 */
export async function getBook(tokenId: string) {
  try {
    return await clobClient.getOrderBook(tokenId);
  } catch (error) {
    polymarketAPILogger.error("Error getting market for {tokenId}: {error}", {
      tokenId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}


export const placePolymarketOrder = async (tokenId: string, price: number): Promise<void> => {
  try {
    await placeOrder(tokenId, price);
  } catch (error) {
    polymarketAPILogger.error("Error placing order: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
};


export const getPricesHistory = async (market: string, startTs: number, endTs: number) => {
  try {
    return clobClient.getPricesHistory({ market, startTs, endTs });
  } catch (error) {
    polymarketAPILogger.error("Error getting prices history: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};


export const getBuyedOrder = async (market: string) => {
  try {
    return await clienAuth.getTrades({ market: market, maker_address: address });
  } catch (error) {
    polymarketAPILogger.error("Error getting bought orders: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

export const getOrder = async (orderId: string) => {
  try {
    return await clienAuth.getOrder(orderId);
  } catch (error) {
    polymarketAPILogger.error("Error getting order: {error}", {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}