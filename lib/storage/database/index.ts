import { Database } from "bun:sqlite";
import type { DatabaseRecord, Order, Trade } from "./mode";
import { dbLogger } from "../../../utils/logger";

export class DatabaseManager {
  private db: Database;

  constructor(dbPath: string = "db.sqlite") {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    // Enable Write-Ahead Logging for better concurrency
    this.db.run("PRAGMA journal_mode=WAL;");

    // Create table based on DatabaseRecord model from mode.ts
    this.db.run(
      `CREATE TABLE IF NOT EXISTS markets (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          "order" TEXT,
          Up TEXT,
          Down TEXT
        )`
    );
    dbLogger.info("Database started");
  }

  // CREATE - Insert new market record
  createMarket(market: DatabaseRecord): void {
    try {
      this.db.run("BEGIN");
      const existing = this.getMarket(market.id);
      if (!existing) {
        this.db.run(
          "INSERT INTO markets (id, title, \"order\", Up, Down) VALUES (?, ?, ?, ?, ?)",
          [
            market.id, 
            market.title, 
            market.order ? JSON.stringify(market.order) : null,
            market.Up ? JSON.stringify(market.Up) : null,
            market.Down ? JSON.stringify(market.Down) : null
          ]
        );
        dbLogger.info(`Market ${market.id} created`);
      }
      this.db.run("COMMIT");
    } catch (e) {
      this.db.run("ROLLBACK");
      if (String(e).includes("UNIQUE constraint failed")) {
        dbLogger.debug(`Market ${market.id} already exists, skipping creation.`);
      } else {
        throw e;
      }
    }
  }

  // READ - Get market by id
  getMarket(id: string): DatabaseRecord | null {
    const row = this.db.query("SELECT * FROM markets WHERE id = ?").get(id) as { 
      id: string; 
      title: string; 
      order: string | null; 
      Up: string | null; 
      Down: string | null; 
    } | null;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      title: row.title,
      order: row.order ? JSON.parse(row.order) : undefined,
      Up: row.Up ? JSON.parse(row.Up) : undefined,
      Down: row.Down ? JSON.parse(row.Down) : undefined,
    };
  }

  // READ - Get all markets
  getAllMarkets(): DatabaseRecord[] {
    const rows = this.db.query("SELECT * FROM markets").all() as { 
      id: string; 
      title: string; 
      order: string | null; 
      Up: string | null; 
      Down: string | null; 
    }[];

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      order: row.order ? JSON.parse(row.order) : undefined,
      Up: row.Up ? JSON.parse(row.Up) : undefined,
      Down: row.Down ? JSON.parse(row.Down) : undefined,
    }));
  }

  // PUSH - Add order to market's order array
  pushOrder(marketId: string, order: Order): void {
    const market = this.getMarket(marketId);
    if (!market) {
      throw new Error(`Market with id ${marketId} not found`);
    }

    const orders = market.order || [];
    orders.push(order);

    this.db.run(
      'UPDATE markets SET "order" = ? WHERE id = ?',
      [JSON.stringify(orders), marketId]
    );
    // dbLogger.info(`Order added to market ${marketId}`);
  }

  // PUSH - Add trade to market's Up/Down side trades array
  pushTrade(marketId: string, side: "Up" | "Down", trade: Trade): void {
    const market = this.getMarket(marketId);
    if (!market) {
      throw new Error(`Market with id ${marketId} not found`);
    }

    // Initialize side if it doesn't exist
    if (!market[side]) {
      market[side] = {
        assetId: "",
        trades: []
      };
    }

    market[side]!.trades.push(trade);

    this.db.run(
      `UPDATE markets SET ${side} = ? WHERE id = ?`,
      [JSON.stringify(market[side]), marketId]
    );
    // dbLogger.info(`Trade added to market ${marketId} ${side} side`);
  }

  // PUSH - Set assetId for a market side (only if not already set)
  setAssetId(marketId: string, side: "Up" | "Down", assetId: string): void {
    const market = this.getMarket(marketId);
    if (!market) {
      throw new Error(`Market with id ${marketId} not found`);
    }

    // Initialize side if it doesn't exist
    if (!market[side]) {
      market[side] = {
        assetId: assetId,
        trades: []
      };
    } else if (market[side]!.assetId === "" || !market[side]!.assetId) {
      // Only update if assetId is empty
      market[side]!.assetId = assetId;
    } else {
      // AssetId already set, don't update
      return;
    }

    this.db.run(
      `UPDATE markets SET ${side} = ? WHERE id = ?`,
      [JSON.stringify(market[side]), marketId]
    );
    // dbLogger.info(`AssetId set for market ${marketId} ${side} side`);
  }
}

// Create and export a singleton instance
export const databaseManager = new DatabaseManager();