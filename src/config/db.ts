import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbDir = path.resolve(__dirname, "../../database");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, "app.sqlite");
export const db = new Database(dbPath);

// Enable WAL mode & foreign keys for optimal performance and integrity
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure schema is executed
const schemaPath = path.join(dbDir, "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schemaSql);
}

// Upgrade schema if needed
try {
  const columns = db.pragma("table_info(job_activities)") as { name: string }[];
  const colMap = new Set(columns.map((c) => c.name));

  const newCols: Record<string, string> = {
    article_count: "INTEGER NOT NULL DEFAULT 1",
    photo_count: "INTEGER NOT NULL DEFAULT 0",
    social_post_count: "INTEGER NOT NULL DEFAULT 0",
    check_backup: "INTEGER NOT NULL DEFAULT 0",
  };

  for (const [colName, colDef] of Object.entries(newCols)) {
    if (!colMap.has(colName)) {
      try {
        db.exec(`ALTER TABLE job_activities ADD COLUMN ${colName} ${colDef}`);
      } catch {
        // Ignore if column already exists
      }
    }
  }
} catch {
  // Table not yet created
}

console.log(`[DB] Connected to SQLite database at ${dbPath}`);
