"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dbDir = path_1.default.resolve(__dirname, "../../database");
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path_1.default.join(dbDir, "app.sqlite");
exports.db = new better_sqlite3_1.default(dbPath);
// Enable WAL mode & foreign keys for optimal performance and integrity
exports.db.pragma("journal_mode = WAL");
exports.db.pragma("foreign_keys = ON");
// Ensure schema is executed
const schemaPath = path_1.default.join(dbDir, "schema.sql");
if (fs_1.default.existsSync(schemaPath)) {
    const schemaSql = fs_1.default.readFileSync(schemaPath, "utf-8");
    exports.db.exec(schemaSql);
}
// Upgrade schema if needed
try {
    const columns = exports.db.pragma("table_info(job_activities)");
    const colMap = new Set(columns.map((c) => c.name));
    const newCols = {
        article_count: "INTEGER NOT NULL DEFAULT 1",
        photo_count: "INTEGER NOT NULL DEFAULT 0",
        social_post_count: "INTEGER NOT NULL DEFAULT 0",
        check_backup: "INTEGER NOT NULL DEFAULT 0",
    };
    for (const [colName, colDef] of Object.entries(newCols)) {
        if (!colMap.has(colName)) {
            try {
                exports.db.exec(`ALTER TABLE job_activities ADD COLUMN ${colName} ${colDef}`);
            }
            catch {
                // Ignore if column already exists
            }
        }
    }
}
catch {
    // Table not yet created
}
console.log(`[DB] Connected to SQLite database at ${dbPath}`);
