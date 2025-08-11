import { Database } from "bun:sqlite";
import type { DatabaseRecord, Trade } from "./types";

export const db = new Database("db.sqlite");

export function init() {
  db.run(
    `CREATE TABLE IF NOT EXISTS markets (
      id TEXT PRIMARY KEY,
      "order" TEXT,
      up TEXT,
      down TEXT
    )`
  );
}

export function createMarket(market: DatabaseRecord) {
  const { id, order, up, down } = market;
  db.run(
    "INSERT INTO markets (id, \"order\", up, down) VALUES (?, ?, ?, ?)",
    [id, JSON.stringify(order), JSON.stringify(up), JSON.stringify(down)]
  );
}

export function getMarket(id: string): DatabaseRecord | null {
    const row = db.query("SELECT * FROM markets WHERE id = ?").get(id) as { id: string; order: string; up: string; down: string } | null;
  
    if (!row) {
      return null;
    }
  
    return {
      id: row.id,
      order: JSON.parse(row.order),
      up: JSON.parse(row.up),
      down: JSON.parse(row.down),
    };
  }
  
  export function updateMarket(id: string, market: Partial<DatabaseRecord>) {
    const existingMarket = getMarket(id);
    if (!existingMarket) {
      throw new Error(`Market with id ${id} not found`);
    }
  
    const updatedMarket = { ...existingMarket, ...market };
  
    db.run(
      'UPDATE markets SET "order" = ?, up = ?, down = ? WHERE id = ?',
      [
        JSON.stringify(updatedMarket.order),
        JSON.stringify(updatedMarket.up),
        JSON.stringify(updatedMarket.down),
        id,
      ]
    );
  }
  
  export function deleteMarket(id: string) {
    db.run("DELETE FROM markets WHERE id = ?", [id]);
  }
  
  export function addTrade(marketId: string, side: "up" | "down", trade: Trade) {
    const market = getMarket(marketId);
    if (!market) {
      throw new Error(`Market with id ${marketId} not found`);
    }
  
    const updatedMarket = { ...market };
    updatedMarket[side].trades.push(trade);
  
    updateMarket(marketId, { [side]: updatedMarket[side] });
  }
