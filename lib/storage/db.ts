import { Database } from "bun:sqlite";
import type { DatabaseRecord, Order, Trade } from "./types";
import { dbLogger } from "../../utils/logger";

export const db = new Database("db.sqlite");
// Enable Write-Ahead Logging for better concurrency
db.run("PRAGMA journal_mode=WAL;");

export function init() {
  db.run(
    `CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      "order" TEXT,
      up TEXT,
      down TEXT
    )`
  );
  //dbLogger.info("Database initialized");
}

export function createMarket(market: DatabaseRecord) {
  try {
    db.run("BEGIN");
    const existing = getMarket(market.id);
    if (!existing) {
      db.run(
        "INSERT INTO markets (id, title, \"order\", up, down) VALUES (?, ?, ?, ?, ?)",
        [market.id, market.title, JSON.stringify(market.order), JSON.stringify(market.up), JSON.stringify(market.down)]
      );
      dbLogger.info(`Market ${market.id} created`);
    } else {
      //dbLogger.info(`Market ${market.id} already exists, skipping creation.`);
    }
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    if (String(e).includes("UNIQUE constraint failed")) {
      //dbLogger.info(`Market ${market.id} already exists (race condition), skipping creation.`);
    } else {
      throw e;
    }
  }
}

export function getMarket(id: string): DatabaseRecord | null {
    const row = db.query("SELECT * FROM markets WHERE id = ?").get(id) as { id: string; title: string; order: string; up: string; down: string } | null;
  
    if (!row) {
      return null;
    }
  
    //dbLogger.debug(`Market ${id} retrieved`);
    return {
      id: row.id,
      title: row.title,
      order: row.order ? JSON.parse(row.order) : undefined,
      up: row.up ? JSON.parse(row.up) : undefined,
      down: row.down ? JSON.parse(row.down) : undefined,
    };
  }
  
  export function updateMarket(id: string, market: Partial<DatabaseRecord>) {
    const existingMarket = getMarket(id);
    if (!existingMarket) {
      throw new Error(`Market with id ${id} not found`);
    }
  
    const updatedMarket = { ...existingMarket, ...market };
  
    db.run(
      'UPDATE markets SET title = ?, "order" = ?, up = ?, down = ? WHERE id = ?',
      [
        updatedMarket.title,
        JSON.stringify(updatedMarket.order),
        JSON.stringify(updatedMarket.up),
        JSON.stringify(updatedMarket.down),
        id,
      ]
    );
    //dbLogger.info(`Market ${id} updated`);
  }
  
  export function deleteMarket(id: string) {
    db.run("DELETE FROM markets WHERE id = ?", [id]);
    //dbLogger.info(`Market ${id} deleted`);
  }
  
  export function addTrade(marketId: string, side: "up" | "down", trade: Trade) {
    const market = getMarket(marketId);
    if (!market) {
      throw new Error(`Market with id ${marketId} not found`);
    }
  
    const updatedMarket = { ...market };
    if (!updatedMarket[side]) {
      throw new Error(`Market side "${side}" does not exist for market "${marketId}". Please initialize it first.`);
    }
    updatedMarket[side].trades.push(trade);
  
    updateMarket(marketId, { [side]: updatedMarket[side] });
    //dbLogger.info(`Trade added to market ${marketId}`);
  }
  
  export function updateOrder(marketId: string, order: Order) {
    updateMarket(marketId, { order });
    //dbLogger.info(`Order updated for market ${marketId}`);
  }
  
export function updateAssetId(
  marketId: string,
  side: "up" | "down",
  assetId: string
) {
  const market = getMarket(marketId);
  if (!market) {
    throw new Error(`Market with id ${marketId} not found`);
  }
  // Only update if assetId is empty string
  if (market[side]?.assetId && market[side].assetId !== "") {
    return;
  }
  const updatedSide = {
    assetId,
    trades: market[side]?.trades || [],
  };
  updateMarket(marketId, { [side]: updatedSide });
  //dbLogger.info(`assetId updated for market ${marketId}`);
}
