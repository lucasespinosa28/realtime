import Database from "bun:sqlite";
import type { Payload, Book } from "../websocket/model";
import { dbLogger } from "../../utils/logger";

type PayloadRow = {
    asset_id: string;
    hash: string;
    market: string;
    min_order_size: string;
    neg_risk: number;
    tick_size: string;
    timestamp: string;
    asks: string;
    bids: string;
};

export class OrderBookDatabase {
    private db: Database;

    constructor(dbPath = "orderBook.sqlite") {
        this.db = new Database(dbPath);
        this.initialize();
    }

    private initialize() {
        this.db.run(`
      CREATE TABLE IF NOT EXISTS payloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT,
        hash TEXT,
        market TEXT,
        min_order_size TEXT,
        neg_risk INTEGER,
        tick_size TEXT,
        timestamp TEXT,
        asks TEXT,
        bids TEXT
      )
    `);
    }

    create(payload: Payload): { success: boolean } {
        try {
            this.db.run(
                `INSERT INTO payloads (asset_id, hash, market, min_order_size, neg_risk, tick_size, timestamp, asks, bids)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    payload.asset_id,
                    payload.hash,
                    payload.market,
                    payload.min_order_size,
                    payload.neg_risk ? 1 : 0,
                    payload.tick_size,
                    payload.timestamp,
                    JSON.stringify(payload.asks),
                    JSON.stringify(payload.bids)
                ]
            );
            dbLogger.debug("Received orderbook for asset {assetId}: {askCount} asks, {bidCount} bids", {
                askCount: payload.asks.length || 0,
                bidCount: payload.bids.length || 0
            });
            return { success: true };
        } catch {
            return { success: false };
        }
    }

    getAll(): Payload[] {
        const rows = this.db.query("SELECT * FROM payloads").all() as PayloadRow[];
        return rows.map((row) => ({
            asset_id: row.asset_id,
            hash: row.hash,
            market: row.market,
            min_order_size: row.min_order_size,
            neg_risk: !!row.neg_risk,
            tick_size: row.tick_size,
            timestamp: row.timestamp,
            asks: JSON.parse(row.asks) as Book[],
            bids: JSON.parse(row.bids) as Book[]
        }));
    }
}