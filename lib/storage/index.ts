

import Database from "bun:sqlite";
import type { Instructions } from "../../config/model";
import { dbLogger } from "../../utils/logger";
import type { Market, TradeOrder } from "./model";

const reported = new Map();

const logger = {
  getAllIds: () => Array.from(reported.keys()),
  hasId: (id: string) => reported.has(id),
  add: (id: string, data: boolean) => reported.set(id, data),
  get: (id: string): boolean => reported.get(id),
  delete: (id: string) => reported.delete(id)
}


class DatabaseMemoryManager {
  private db: Database;

  constructor() {
    this.db = new Database(":memory:");
    this.initialize();
  }

  private initialize() {
    // Enable Write-Ahead Logging for better concurrency
    this.db.run("PRAGMA journal_mode=WAL;");

    // Create trades instructions
    this.db.run(
      `CREATE TABLE IF NOT EXISTS instructions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
           title TEXT,
           minutes INTEGER,
           price REAL,
           size INTEGER
        )`
    );
    // Create TradeOrder table with its own autoincrement id
    this.db.run(
      `CREATE TABLE IF NOT EXISTS trade_orders (
      id TEXT,
      orderID TEXT,
      status TEXT,
      conditionId TEXT,
      asset TEXT,
      title TEXT,
      price REAL,
      timestamp INTEGER
    )`
    );

    dbLogger.info("Database initialized with instructions and trade_orders");
  }

  insertInstruction(instructions: Instructions[]): { success: boolean; } {
    try {
      const stmt = this.db.prepare(
        `INSERT INTO instructions (title, minutes, price, size) VALUES (?, ?, ?, ?)`
      );

      for (const instruction of instructions) {
        stmt.run(instruction.title, instruction.minutes, instruction.price, instruction.size);
      }

      dbLogger.info("Instructions inserted successfully");
      return { success: true };
    } catch (error) {
      console.error("INSERT ERROR:", error); // Debug line
      dbLogger.error("Failed to insert instructions: {error}", {
        error: error instanceof Error ? error.message : String(error)
      });
      return { success: false };
    }
  }
  getInstructionByTitle(title: string): Instructions | null {
    const stmt = this.db.prepare(`SELECT * FROM instructions WHERE title = ?`);
    return stmt.get(title) as Instructions | null;
  }
  getAllInstructions(): Instructions[] {
    const stmt = this.db.prepare(`SELECT * FROM instructions`);
    return stmt.all() as Instructions[];
  }

  getInstructionByPartialTitle(searchTerm: string): Instructions | null {
    const stmt = this.db.prepare(`SELECT * FROM instructions WHERE title LIKE ?`);
    return stmt.get(`%${searchTerm}%`) as Instructions | null;
  }
  createTradeOrder(order: TradeOrder): { success: boolean; } {
    try {
      const insert = this.db.prepare(
        `INSERT INTO trade_orders (id, orderID, status, conditionId, asset, title, price, timestamp) VALUES ($id, $orderID, $status, $conditionId, $asset, $title, $price, $timestamp)`
      );

      insert.run({
        id: order.tradeData.conditionId,
        orderID: order.orderID,
        status: order.status,
        conditionId: order.tradeData.conditionId,
        asset: order.tradeData.asset,
        title: order.tradeData.title,
        price: order.tradeData.price,
        timestamp: order.tradeData.timestamp
      });

      return { success: true };
    } catch (error) {
      dbLogger.error("Failed to insert trade order:", { error });
      return { success: false };
    }
  }

  readTradeOrder(orderID: string): TradeOrder | null {
    const stmt = this.db.prepare(`SELECT * FROM trade_orders WHERE orderID = ?`);
    type TradeOrderRow = {
      id: string;
      orderID: string;
      status: string;
      conditionId: string;
      asset: string;
      title: string;
      price: number;
      timestamp: number;
    };
    const row = stmt.get(orderID) as TradeOrderRow | undefined;
    if (!row) return null;
    // Map the row to a TradeOrder object explicitly
    return {
      orderID: row.orderID,
      status: row.status,
      tradeData: {
        conditionId: row.conditionId,
        asset: row.asset,
        title: row.title,
        price: row.price,
        timestamp: row.timestamp
      }
    } as TradeOrder;
  }

  updateTradeOrder(order: TradeOrder): { success: boolean; } {
    try {
      const update = this.db.prepare(
        `UPDATE trade_orders SET status = $status, conditionId = $conditionId, asset = $asset, title = $title, price = $price, timestamp = $timestamp WHERE orderID = $orderID`
      );

      update.run({
        status: order.status,
        conditionId: order.tradeData.conditionId,
        asset: order.tradeData.asset,
        title: order.tradeData.title,
        price: order.tradeData.price,
        timestamp: order.tradeData.timestamp,
        orderID: order.orderID
      });

      return { success: true };
    } catch (error) {
      dbLogger.error("Failed to update trade order:", { error });
      return { success: false };
    }
  }

  deleteTradeOrder(orderID: string): { success: boolean; } {
    try {
      const deleteStmt = this.db.prepare(`DELETE FROM trade_orders WHERE orderID = ?`);
      deleteStmt.run(orderID);
      return { success: true };
    } catch (error) {
      dbLogger.error("Failed to delete trade order:", { error });
      return { success: false };
    }
  }

  existTradeOrder(orderID: string): boolean {
    const stmt = this.db.prepare(`SELECT 1 FROM trade_orders WHERE orderID = ?`);
    return !!stmt.get(orderID);
  }

  // UTILITY
  close(): void {
    this.db.close();
    dbLogger.info("Database connection closed");
  }
}


class DatabaseManager {
  private db: Database;

  constructor(dbPath: string = "markets.sqlite") {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize() {
    // Enable Write-Ahead Logging for better concurrency
    this.db.run("PRAGMA journal_mode=WAL;");

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
      rewards: typeof row.rewards === "string" ? JSON.parse(row.rewards) : row.rewards ?? null,
      is_50_50_outcome: !!row.is_50_50_outcome,
      tokens: typeof row.tokens === "string" ? JSON.parse(row.tokens) : row.tokens ?? [],
      tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags ?? []
    }));
  }
  // UTILITY
  close(): void {
    this.db.close();
    dbLogger.info("Database connection closed");
  }
}

export { logger, DatabaseMemoryManager, DatabaseManager };