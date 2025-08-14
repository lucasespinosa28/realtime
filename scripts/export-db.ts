import { Database } from "bun:sqlite";
import { writeFileSync } from "fs";

const db = new Database("db.sqlite");

const rows = db.query("SELECT * FROM markets").all();

// Parse JSON fields

const parsedRows = rows.map(row => {
  const r = row as { id: string; title: string; order: string | null; up?: string | null; down?: string | null; Up?: string | null; Down?: string | null };
  // Prefer lowercase, fallback to uppercase
  const order = r.order ? JSON.parse(r.order) : undefined;
  const upRaw = r.up ?? r.Up;
  const downRaw = r.down ?? r.Down;
  return {
    ...r,
    order,
    up: upRaw ? JSON.parse(upRaw) : undefined,
    down: downRaw ? JSON.parse(downRaw) : undefined,
  };
});

writeFileSync("markets_export1.json", JSON.stringify(parsedRows, null, 2));

console.log(`Exported ${parsedRows.length} markets to markets_export.json`);
