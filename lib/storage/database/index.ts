import { Database } from "bun:sqlite";
import type { Trade } from "./model";
import { dbLogger } from "../../../utils/logger";

export class DatabaseManager {
  private db: Database;

  constructor(dbPath: string = "tradesdb.sqlite") {
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
          timestamp TEXT NOT NULL,
          bio TEXT NOT NULL,
          eventSlug TEXT NOT NULL,
          icon TEXT NOT NULL,
          name TEXT NOT NULL,
          outcomeIndex INTEGER NOT NULL,
          profileImage TEXT NOT NULL,
          proxyWallet TEXT NOT NULL,
          pseudonym TEXT NOT NULL,
          slug TEXT NOT NULL,
          title TEXT NOT NULL,
          transactionHash TEXT NOT NULL
        )`
    );


    dbLogger.info("Database initialized with trades (auto-increment with extended fields), buy_orders, and sell_orders tables");
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
      bio: string;
      eventSlug: string;
      icon: string;
      name: string;
      outcomeIndex: number;
      profileImage: string;
      proxyWallet: string;
      pseudonym: string;
      slug: string;
      title: string;
      transactionHash: string;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      outcome: row.outcome,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp,
      bio: row.bio,
      eventSlug: row.eventSlug,
      icon: row.icon,
      name: row.name,
      outcomeIndex: row.outcomeIndex,
      profileImage: row.profileImage,
      proxyWallet: row.proxyWallet,
      pseudonym: row.pseudonym,
      slug: row.slug,
      title: row.title,
      transactionHash: row.transactionHash
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
      bio: string;
      eventSlug: string;
      icon: string;
      name: string;
      outcomeIndex: number;
      profileImage: string;
      proxyWallet: string;
      pseudonym: string;
      slug: string;
      title: string;
      transactionHash: string;
    } | null;

    if (!row) return null;

    return {
      asset: row.asset,
      outcome: row.outcome,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp,
      bio: row.bio,
      eventSlug: row.eventSlug,
      icon: row.icon,
      name: row.name,
      outcomeIndex: row.outcomeIndex,
      profileImage: row.profileImage,
      proxyWallet: row.proxyWallet,
      pseudonym: row.pseudonym,
      slug: row.slug,
      title: row.title,
      transactionHash: row.transactionHash
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
      bio: string;
      eventSlug: string;
      icon: string;
      name: string;
      outcomeIndex: number;
      profileImage: string;
      proxyWallet: string;
      pseudonym: string;
      slug: string;
      title: string;
      transactionHash: string;
    }[];

    return rows.map(row => ({
      asset: row.asset,
      outcome: row.outcome,
      conditionId: row.conditionId,
      price: row.price,
      size: row.size,
      side: row.side,
      timestamp: row.timestamp,
      bio: row.bio,
      eventSlug: row.eventSlug,
      icon: row.icon,
      name: row.name,
      outcomeIndex: row.outcomeIndex,
      profileImage: row.profileImage,
      proxyWallet: row.proxyWallet,
      pseudonym: row.pseudonym,
      slug: row.slug,
      title: row.title,
      transactionHash: row.transactionHash
    }));
  }

  setTrade(trade: Trade): void {
    this.db.run(
      "INSERT INTO trades (asset, outcome, conditionId, price, size, side, timestamp, bio, eventSlug, icon, name, outcomeIndex, profileImage, proxyWallet, pseudonym, slug, title, transactionHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        trade.asset, 
        trade.outcome, 
        trade.conditionId, 
        trade.price, 
        trade.size, 
        trade.side, 
        trade.timestamp,
        trade.bio,
        trade.eventSlug,
        trade.icon,
        trade.name,
        trade.outcomeIndex,
        trade.profileImage,
        trade.proxyWallet,
        trade.pseudonym,
        trade.slug,
        trade.title,
        trade.transactionHash
      ]
    );
  }
  // UTILITY
  close(): void {
    this.db.close();
    dbLogger.info("Database connection closed");
  }
}

// Create and export a singleton instance
export const databaseManager = new DatabaseManager();