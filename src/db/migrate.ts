// Standalone migration runner used at container boot (see docker-entrypoint.sh).
//
// We deliberately avoid drizzle-kit here: it is a devDependency and is NOT
// traced into Next's `output: "standalone"` bundle. Instead we use drizzle-orm's
// better-sqlite3 migrator directly — both better-sqlite3 and drizzle-orm are
// runtime dependencies present in the final image, so this is the reliable path.
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { randomUUID } from "node:crypto";
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

// Idempotently ensure the configured ADMIN_EMAIL exists as an admin. This runs
// on every boot (see docker-entrypoint.sh) so production never needs a manual
// seeding step. We use RAW better-sqlite3 SQL here on purpose: this file is
// transpiled into a single-file `migrate.mjs` (bundle=false) in the standalone
// image, so it must only depend on packages present in that image and node
// built-ins — importing "./schema" or the drizzle query builder would break it.
const adminEmail = process.env.ADMIN_EMAIL;
if (adminEmail) {
  const existing = sqlite
    .prepare("SELECT id, role FROM user WHERE email = ?")
    .get(adminEmail) as { id: string; role: string } | undefined;

  if (!existing) {
    sqlite
      .prepare(
        "INSERT INTO user (id, name, email, role, active, created_at) VALUES (?, ?, ?, 'admin', 1, ?)",
      )
      .run(randomUUID(), "Admin", adminEmail, Date.now());
    console.log(`[migrate] seeded admin: ${adminEmail}`);
  } else if (existing.role !== "admin") {
    sqlite
      .prepare("UPDATE user SET role = 'admin', active = 1 WHERE id = ?")
      .run(existing.id);
    console.log(`[migrate] promoted existing user ${adminEmail} to admin`);
  } else {
    console.log(`[migrate] admin ${adminEmail} already exists; nothing to do`);
  }
} else {
  console.log("[migrate] ADMIN_EMAIL not set; skipping admin seed");
}

sqlite.close();
