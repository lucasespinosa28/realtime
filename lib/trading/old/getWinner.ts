import { clobClient } from "..";
import { polymarketAPILogger } from "../../../utils/logger";
import type { MarketWinner } from "../model";

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
