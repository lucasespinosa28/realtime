import { Database } from "bun:sqlite";
import type { Trade, Market } from "./model";
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

    // Create markets table
    this.db.run(
      `CREATE TABLE IF NOT EXISTS markets (
          market_slug TEXT PRIMARY KEY,
          enable_order_book INTEGER,
          active INTEGER,
          closed INTEGER,
          archived INTEGER,
          accepting_orders INTEGER,
          accepting_order_timestamp TEXT,
          minimum_order_size REAL,
          minimum_tick_size REAL,
          condition_id TEXT,
          question_id TEXT,
          question TEXT,
          description TEXT,
          end_date_iso TEXT,
          game_start_time TEXT,
          seconds_delay INTEGER,
          fpmm TEXT,
          maker_base_fee REAL,
          taker_base_fee REAL,
          notifications_enabled INTEGER,
          neg_risk INTEGER,
          neg_risk_market_id TEXT,
          neg_risk_request_id TEXT,
          icon TEXT,
          image TEXT,
          rewards TEXT,
          is_50_50_outcome INTEGER,
          tokens TEXT,
          tags TEXT
        )`
    );
    dbLogger.info("Database initialized with trades (auto-increment with extended fields), buy_orders, and sell_orders tables");
  }

  // MARKET OPERATIONS
  setMarket(market: Market): void {
    // Check if market already exists
    const exists = this.db.query(
      "SELECT 1 FROM markets WHERE market_slug = ? LIMIT 1"
    ).get(market.market_slug);

    if (exists) {
      dbLogger.warning(`Market already exists ${market.market_slug}`);
      // Market already exists, do not insert/update
      return;
    }

    this.db.run(
      `INSERT INTO markets (
        market_slug, enable_order_book, active, closed, archived, accepting_orders, accepting_order_timestamp, minimum_order_size, minimum_tick_size, condition_id, question_id, question, description, end_date_iso, game_start_time, seconds_delay, fpmm, maker_base_fee, taker_base_fee, notifications_enabled, neg_risk, neg_risk_market_id, neg_risk_request_id, icon, image, rewards, is_50_50_outcome, tokens, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        market.market_slug,
        market.enable_order_book ? 1 : 0,
        market.active ? 1 : 0,
        market.closed ? 1 : 0,
        market.archived ? 1 : 0,
        market.accepting_orders ? 1 : 0,
        market.accepting_order_timestamp ?? null,
        market.minimum_order_size,
        market.minimum_tick_size,
        market.condition_id,
        market.question_id,
        market.question,
        market.description,
        market.end_date_iso,
        market.game_start_time ?? null,
        market.seconds_delay,
        market.fpmm,
        market.maker_base_fee,
        market.taker_base_fee,
        market.notifications_enabled ? 1 : 0,
        market.neg_risk ? 1 : 0,
        market.neg_risk_market_id,
        market.neg_risk_request_id,
        market.icon,
        market.image,
        market.rewards ? JSON.stringify(market.rewards) : null,
        market.is_50_50_outcome ? 1 : 0,
        market.tokens ? JSON.stringify(market.tokens) : null,
        market.tags ? JSON.stringify(market.tags) : null
      ]
    );
  }

  getAllMarkets(): Market[] {
    const rows = this.db.query("SELECT * FROM markets").all() as Market[];
    return rows.map(row => ({
      enable_order_book: !!row.enable_order_book,
      active: !!row.active,
      closed: !!row.closed,
      archived: !!row.archived,
      accepting_orders: !!row.accepting_orders,
      accepting_order_timestamp: row.accepting_order_timestamp,
      minimum_order_size: row.minimum_order_size,
      minimum_tick_size: row.minimum_tick_size,
      condition_id: row.condition_id,
      question_id: row.question_id,
      question: row.question,
      description: row.description,
      market_slug: row.market_slug,
      end_date_iso: row.end_date_iso,
      game_start_time: row.game_start_time,
      seconds_delay: row.seconds_delay,
      fpmm: row.fpmm,
      maker_base_fee: row.maker_base_fee,
      taker_base_fee: row.taker_base_fee,
      notifications_enabled: !!row.notifications_enabled,
      neg_risk: !!row.neg_risk,
      neg_risk_market_id: row.neg_risk_market_id,
      neg_risk_request_id: row.neg_risk_request_id,
      icon: row.icon,
      image: row.image,
      rewards: row.rewards ? JSON.parse(row.rewards) : null,
      is_50_50_outcome: !!row.is_50_50_outcome,
      tokens: row.tokens ? JSON.parse(row.tokens) : [],
      tags: row.tags ? JSON.parse(row.tags) : []
    }));
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