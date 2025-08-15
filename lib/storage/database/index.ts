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
          id TEXT NOT NULL,
          outcome TEXT NOT NULL,
          market TEXT NOT NULL,
          price REAL NOT NULL,
          size REAL NOT NULL,
          side TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
    );

    // Create buy orders table
    this.db.run(
      `CREATE TABLE IF NOT EXISTS buy_orders (
          id TEXT PRIMARY KEY,
          market TEXT NOT NULL,
          price REAL NOT NULL,
          size REAL NOT NULL,
          side TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
    );

    // Create sell orders table
    this.db.run(
      `CREATE TABLE IF NOT EXISTS sell_orders (
          id TEXT PRIMARY KEY,
          market TEXT NOT NULL,
          price REAL NOT NULL,
          size REAL NOT NULL,
          side TEXT NOT NULL,
          timestamp TEXT NOT NULL
        )`
    );

    dbLogger.info("Database initialized with trades (auto-increment), buy_orders, and sell_orders tables");
  }

  // TRADE OPERATIONS
  getTrade(id: string): Trade | null {
    const row = this.db.query("SELECT * FROM trades WHERE id = ? ORDER BY row_id DESC LIMIT 1").get(id) as { 
      row_id: number;
      id: string; 
      outcome: string;
      market: string;
      price: number;
      size: number;
      side: string;
      timestamp: number;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      outcome: row.outcome,
      market: row.market,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    };
  }

  getAllTrades(id: string): Trade[] {
    const rows = this.db.query("SELECT * FROM trades WHERE id = ? ORDER BY row_id ASC").all(id) as { 
      row_id: number;
      id: string; 
      outcome: string;
      market: string;
      price: number;
      size: number;
      side: string;
      timestamp: number;
    }[];

    return rows.map(row => ({
      id: row.id,
      outcome: row.outcome,
      market: row.market,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }

  setTrade(trade: Trade): void {
    this.db.run(
      "INSERT INTO trades (id, outcome, market, price, size, side, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [trade.id, trade.outcome, trade.market, trade.price, trade.size, trade.side, trade.timestamp]
    );
    dbLogger.info(`Trade ${trade.id} inserted`);
  }

  // BUY OPERATIONS
  getBuy(id: string): Buy | null {
    const row = this.db.query("SELECT * FROM buy_orders WHERE id = ?").get(id) as { 
      id: string; 
      market: string;
      price: number;
      size: number;
      side: "BUY";
      timestamp: number;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      market: row.market,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    };
  }

  setBuy(buy: Buy): void {
    this.db.run(
      "INSERT OR REPLACE INTO buy_orders (id, market, price, size, side, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [buy.id, buy.market, buy.price, buy.size, buy.side, buy.timestamp]
    );
    dbLogger.info(`Buy order ${buy.id} set`);
  }

  getAllBuys(id: string): Buy[] {
    const rows = this.db.query("SELECT * FROM buy_orders WHERE id = ?").all(id) as { 
      id: string; 
      market: string;
      price: number;
      size: number;
      side: "BUY";
      timestamp: number;
    }[];

    return rows.map(row => ({
      id: row.id,
      market: row.market,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    }));
  }

  // SELL OPERATIONS
  getSell(id: string): Sell | null {
    const row = this.db.query("SELECT * FROM sell_orders WHERE id = ?").get(id) as { 
      id: string; 
      market: string;
      price: number;
      size: number;
      side: "SELL";
      timestamp: number;
    } | null;

    if (!row) return null;

    return {
      id: row.id,
      market: row.market,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp
    };
  }

  setSell(sell: Sell): void {
    this.db.run(
      "INSERT OR REPLACE INTO sell_orders (id, market, price, size, side, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      [sell.id, sell.market, sell.price, sell.size, sell.side, sell.timestamp]
    );
    dbLogger.info(`Sell order ${sell.id} set`);
  }

  getAllSells(id: string): Sell[] {
    const rows = this.db.query("SELECT * FROM sell_orders WHERE id = ?").all(id) as { 
      id: string; 
      market: string;
      price: number;
      size: number;
      side: "SELL";
      timestamp: number;
    }[];

    return rows.map(row => ({
      id: row.id,
      market: row.market,
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