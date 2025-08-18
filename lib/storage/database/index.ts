import { Database } from "bun:sqlite";
import type { Trade, Buy, Sell } from "./model";
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

    // Create trades table
    this.db.run(
      `CREATE TABLE IF NOT EXISTS trades (
          row_id INTEGER PRIMARY KEY AUTOINCREMENT,
          asset TEXT NOT NULL,
          outcome TEXT NOT NULL,
          conditionId TEXT NOT NULL,
          price REAL NOT NULL,
          size REAL NOT NULL,
          side TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
    );

    // Create buy orders table
    this.db.run(
      `CREATE TABLE IF NOT EXISTS buy_orders (
          asset TEXT PRIMARY KEY,
          conditionId TEXT NOT NULL,
          price REAL NOT NULL,
          size REAL NOT NULL,
          side TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
    );

    // Create sell orders table
    this.db.run(
      `CREATE TABLE IF NOT EXISTS sell_orders (
          asset TEXT PRIMARY KEY,
          conditionId TEXT NOT NULL,
          price REAL NOT NULL,
          size REAL NOT NULL,
          side TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
    );

    dbLogger.info("Database initialized with trades (auto-increment), buy_orders, and sell_orders tables");
  }

  // TRADE OPERATIONS
  getAllTradesUnfiltered(): Trade[] {
    const rows = this.db.query("SELECT * FROM trades ORDER BY row_id ASC").all() as {
      row_id: number;
      asset: string;
      outcome: string;
      conditionId: string;
      price: number;
      size: number;
      side: string;
      timestamp: number;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      outcome: row.outcome,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }
  getTrade(asset: string): Trade | null {
    const row = this.db.query("SELECT * FROM trades WHERE asset = ? ORDER BY row_id DESC LIMIT 1").get(asset) as { 
      row_id: number;
      asset: string; 
      outcome: string;
      conditionId: string;
      price: number;
      size: number;
      side: string;
      timestamp: number;
    } | null;

    if (!row) return null;

    return {
      asset: row.asset,
      outcome: row.outcome,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    };
  }

  getAllTrades(asset: string): Trade[] {
    const rows = this.db.query("SELECT * FROM trades WHERE asset = ? ORDER BY row_id ASC").all(asset) as { 
      row_id: number;
      asset: string; 
      outcome: string;
      conditionId: string;
      price: number;
      size: number;
      side: string;
      timestamp: number;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      outcome: row.outcome,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }

  setTrade(trade: Trade): void {
    this.db.run(
      "INSERT INTO trades (asset, outcome, conditionId, price, size, side, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [trade.asset, trade.outcome, trade.conditionId, trade.price, trade.size, trade.side, trade.timestamp]
    );
  }

  // BUY OPERATIONS
  getAllBuysUnfiltered(): Buy[] {
    const rows = this.db.query("SELECT * FROM buy_orders").all() as {
      asset: string;
      conditionId: string;
      price: number;
      size: number;
      side: "BUY";
      timestamp: number;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }
  getAllBuyAssets(): string[] {
    const rows = this.db.query("SELECT asset FROM buy_orders").all() as { asset: string }[];
    return rows.map(r => r.asset);
  }

  getBuy(asset: string): Buy | null {
    const row = this.db.query("SELECT * FROM buy_orders WHERE asset = ?").get(asset) as { 
      asset: string; 
      conditionId: string;
      price: number;
      size: number;
      side: "BUY";
      timestamp: number;
    } | null;

    if (!row) return null;

    return {
      asset: row.asset,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    };
  }

  setBuy(buy: Buy): void {
    this.db.run(
      "INSERT OR REPLACE INTO buy_orders (asset, conditionId, price, size, side, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [buy.asset, buy.conditionId, buy.price, buy.size, buy.side, buy.timestamp]
    );
  }

  getAllBuys(asset: string): Buy[] {
    const rows = this.db.query("SELECT * FROM buy_orders WHERE asset = ?").all(asset) as { 
      asset: string; 
      conditionId: string;
      price: number;
      size: number;
      side: "BUY";
      timestamp: number;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }

  // SELL OPERATIONS
  getAllSellsUnfiltered(): Sell[] {
    const rows = this.db.query("SELECT * FROM sell_orders").all() as {
      asset: string;
      conditionId: string;
      price: number;
      size: number;
      side: "SELL";
      timestamp: number;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }
  getSell(asset: string): Sell | null {
    const row = this.db.query("SELECT * FROM sell_orders WHERE asset = ?").get(asset) as { 
      asset: string; 
      conditionId: string;
      price: number;
      size: number;
      side: "SELL";
      timestamp: number;
    } | null;

    if (!row) return null;

    return {
      asset: row.asset,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    };
  }

  setSell(sell: Sell): void {
    this.db.run(
      "INSERT OR REPLACE INTO sell_orders (asset, conditionId, price, size, side, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [sell.asset, sell.conditionId, sell.price, sell.size, sell.side, sell.timestamp]
    );
  }

  getAllSells(asset: string): Sell[] {
    const rows = this.db.query("SELECT * FROM sell_orders WHERE asset = ?").all(asset) as { 
      asset: string; 
      conditionId: string;
      price: number;
      size: number;
      side: "SELL";
      timestamp: number;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }

  // UTILITY
  close(): void {
    this.db.close();
    dbLogger.info("Database connection closed");
  }
}

// Create and export a singleton instance
export const databaseManager = new DatabaseManager();