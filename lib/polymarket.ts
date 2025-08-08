import { ClobClient, OrderType, Side } from "@polymarket/clob-client";
import { polymarketAPILogger } from "../utils/logger";
import { Wallet } from "ethers";

const host = 'https://clob.polymarket.com';
const key = process.env.PK;

if (!key) {
  throw new Error('Missing PK environment variable');
}

const POLYMARKET_PROXY_ADDRESS = process.env.PROXY_ADDRESS;
if (!POLYMARKET_PROXY_ADDRESS) {
  throw new Error('Missing PROXY_ADDRESS environment variable');
}

const signer = new Wallet(key);
const clobClient = new ClobClient(host, 137, signer);
const creds = await clobClient.deriveApiKey();

const clienAuth = new ClobClient(host, 137, signer, creds, 2, POLYMARKET_PROXY_ADDRESS);

export interface MarketWinner {
  winner: string;
  isResolved: boolean;
}

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
export async function getMarket(conditionId: string) {
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
    const order = await clienAuth.createAndPostOrder(
      {
        tokenID: asset,
        price: price,
        side: Side.BUY,
        size: 5,
        feeRateBps: 0,
      },
      { tickSize: "0.01", negRisk: false },
      OrderType.GTC,
    );
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