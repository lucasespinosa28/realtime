import { Database } from "bun:sqlite";
import { writeFileSync } from "fs";

const db = new Database("db.sqlite");

const rows = db.query("SELECT * FROM markets").all();

// Parse JSON fields

const parsedRows = rows.map(row => {
  const r = row as { id: string; title: string; order: string | null; up: string | null; down: string | null };
  return {
    ...r,
    order: r.order ? JSON.parse(r.order) : undefined,
    up: r.up ? JSON.parse(r.up) : undefined,
    down: r.down ? JSON.parse(r.down) : undefined,
  };
});

writeFileSync("markets_export.json", JSON.stringify(parsedRows, null, 2));

console.log(`Exported ${parsedRows.length} markets to markets_export.json`);
