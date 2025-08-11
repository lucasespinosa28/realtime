/**
 * Get full markets with the tag 'Sports'
 */
export function getMarketsWithTagSports(): FullMarketRecord[] {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  const rows = db.query(`SELECT * FROM full_markets`).all() as FullMarketRecord[];
  return rows.filter((row) => {
    const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
    if (!(Array.isArray(tags) && tags.map(t => t.toLowerCase()).includes("sports"))) return false;
    const slug = row.market_slug?.toLowerCase() || "";
    return slug.includes(year) && slug.includes(month) && slug.includes(day);
  }).map((row) => ({
    ...row,
    rewards: typeof row.rewards === "string" ? JSON.parse(row.rewards) : row.rewards,
    tokens: typeof row.tokens === "string" ? JSON.parse(row.tokens) : row.tokens,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags
  }));
}



import { Database } from "bun:sqlite";
import type { DatabaseRecord, FullMarketRecord, Order, Trade } from "./types";
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

export function saveLatestCursor(cursor: string) {
  db.run(`CREATE TABLE IF NOT EXISTS cursors (
    id TEXT PRIMARY KEY,
    value TEXT
  )`);
  db.run(`INSERT OR REPLACE INTO cursors (id, value) VALUES (?, ?)`, ["markets_next_cursor", cursor]);
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

export function createFullMarket(market: FullMarketRecord) {
  db.run("BEGIN");
  try {
    db.run(
      `CREATE TABLE IF NOT EXISTS full_markets (
        id TEXT PRIMARY KEY,
        title TEXT,
        enable_order_book BOOLEAN,
        active BOOLEAN,
        closed BOOLEAN,
        archived BOOLEAN,
        accepting_orders BOOLEAN,
        accepting_order_timestamp INTEGER,
        minimum_order_size REAL,
        minimum_tick_size REAL,
        condition_id TEXT,
        question_id TEXT,
        question TEXT,
        description TEXT,
        market_slug TEXT,
        end_date_iso TEXT,
        game_start_time TEXT,
        seconds_delay INTEGER,
        fpmm TEXT,
        maker_base_fee REAL,
        taker_base_fee REAL,
        notifications_enabled BOOLEAN,
        neg_risk BOOLEAN,
        neg_risk_market_id TEXT,
        neg_risk_request_id TEXT,
        icon TEXT,
        image TEXT,
        rewards TEXT,
        is_50_50_outcome BOOLEAN,
        tokens TEXT,
        tags TEXT
      )`
    );
    db.run(
      `INSERT OR REPLACE INTO full_markets (
        id, title, enable_order_book, active, closed, archived, accepting_orders, accepting_order_timestamp,
        minimum_order_size, minimum_tick_size, condition_id, question_id, question, description, market_slug,
        end_date_iso, game_start_time, seconds_delay, fpmm, maker_base_fee, taker_base_fee, notifications_enabled,
        neg_risk, neg_risk_market_id, neg_risk_request_id, icon, image, rewards, is_50_50_outcome, tokens, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        market.id,
        market.title,
        market.enable_order_book,
        market.active,
        market.closed,
        market.archived,
        market.accepting_orders,
        market.accepting_order_timestamp,
        market.minimum_order_size,
        market.minimum_tick_size,
        market.condition_id,
        market.question_id,
        market.question,
        market.description,
        market.market_slug,
        market.end_date_iso,
        market.game_start_time,
        market.seconds_delay,
        market.fpmm,
        market.maker_base_fee,
        market.taker_base_fee,
        market.notifications_enabled,
        market.neg_risk,
        market.neg_risk_market_id,
        market.neg_risk_request_id,
        market.icon,
        market.image,
        JSON.stringify(market.rewards),
        market.is_50_50_outcome,
        JSON.stringify(market.tokens),
        JSON.stringify(market.tags)
      ]
    );
    db.run("COMMIT");
  } catch (e) {
    db.run("ROLLBACK");
    throw e;
  }
}
/**
 * Get full markets with end_date_iso near to current time (within 24 hours)
 */
export function getMarketsEndingSoon(hours: number = 24): FullMarketRecord[] {
  const now = new Date();
  const nowMs = now.getTime();
  const soon = nowMs + hours * 60 * 60 * 1000;
  const month = now.toLocaleString('en-US', { month: 'long' }).toLowerCase(); // "august"
  const monthShort = now.toLocaleString('en-US', { month: 'short' }).toLowerCase(); // "aug"
  const day = now.getDate().toString(); // "11"
  const formats = [
    `${month}-${day}`,
    `${monthShort}-${day}`,
    `${day}-${month}`,
    `${day}-${monthShort}`,
    `${month} ${day}`,
    `${monthShort} ${day}`,
    `${day} ${month}`,
    `${day} ${monthShort}`,
    `${month}${day}`,
    `${monthShort}${day}`,
    `${day}${month}`,
    `${day}${monthShort}`
  ];
  const rows = db.query(`SELECT * FROM full_markets`).all() as FullMarketRecord[];
  return rows.filter((row) => {
    if (!row.end_date_iso) return false;
    const endDate = new Date(row.end_date_iso).getTime();
    if (!(endDate >= nowMs && endDate <= soon)) return false;
    // Only include if today's month and day appears in question, description, or market_slug
    const fields = [row.question, row.description, row.market_slug].map(f => f?.toLowerCase() || "");
    const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags;
    if (Array.isArray(tags) && tags.map(t => t.toLowerCase()).includes("crypto")) return false;
    return fields.some(f => formats.some(fmt => f.includes(fmt)));
  }).map((row) => ({
    ...row,
    rewards: typeof row.rewards === "string" ? JSON.parse(row.rewards) : row.rewards,
    tokens: typeof row.tokens === "string" ? JSON.parse(row.tokens) : row.tokens,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags
  }));
}