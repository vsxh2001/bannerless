// Standalone migration runner used at container boot (see docker-entrypoint.sh).
//
// We deliberately avoid drizzle-kit here: it is a devDependency and is NOT
// traced into Next's `output: "standalone"` bundle. Instead we use drizzle-orm's
// better-sqlite3 migrator directly — both better-sqlite3 and drizzle-orm are
// runtime dependencies present in the final image, so this is the reliable path.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbPath = process.env.DATABASE_URL ?? "./data/app.db";

// better-sqlite3 creates the DB file but not its parent directory.
const dir = dirname(dbPath);
if (dir && dir !== "." && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

// Migrations folder is resolved relative to the process CWD. The entrypoint runs
// this from the app root, where the committed `drizzle/` folder is copied.
const migrationsFolder = process.env.DRIZZLE_MIGRATIONS_FOLDER ?? "drizzle";

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

console.log(`[migrate] applying migrations from "${migrationsFolder}" to "${dbPath}"`);
migrate(drizzle(sqlite), { migrationsFolder });
console.log("[migrate] done");

sqlite.close();
