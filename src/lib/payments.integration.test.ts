import { randomUUID } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// IMPORTANT: src/db/index.ts reads DATABASE_URL at *import time* and opens a
// module-singleton connection. We must point it at a throwaway temp file
// BEFORE anything pulls in "@/db" (or "@/lib/payments", which imports it).
// Hence: set the env var at top-level, then use dynamic imports below.
const dbPath = join(tmpdir(), `bannerless-test-${randomUUID()}.db`);
process.env.DATABASE_URL = dbPath;

// Filled in by beforeAll via dynamic import.
let db: typeof import("@/db").db;
// The schema module exports tables as `users`, `payments`, `attendance`,
// `trainingSessions` (the underlying SQLite table names differ, e.g. "payment").
let schema: typeof import("@/db").schema;
let ensureDuesForPeriod: typeof import("@/lib/payments").ensureDuesForPeriod;
let markPaymentPaid: typeof import("@/lib/payments").markPaymentPaid;
let getPaymentForMember: typeof import("@/lib/payments").getPaymentForMember;
let MONTHLY_DUES_MINOR: number;
let eq: typeof import("drizzle-orm").eq;
let and: typeof import("drizzle-orm").and;

beforeAll(async () => {
  // Import the db singleton (now bound to our temp DATABASE_URL) and migrate.
  const dbMod = await import("@/db");
  db = dbMod.db;
  schema = dbMod.schema;

  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  migrate(db, { migrationsFolder: "drizzle" });

  const drizzleOrm = await import("drizzle-orm");
  eq = drizzleOrm.eq;
  and = drizzleOrm.and;

  const paymentsMod = await import("@/lib/payments");
  ensureDuesForPeriod = paymentsMod.ensureDuesForPeriod;
  markPaymentPaid = paymentsMod.markPaymentPaid;
  getPaymentForMember = paymentsMod.getPaymentForMember;
  MONTHLY_DUES_MINOR = paymentsMod.MONTHLY_DUES_MINOR;
});

afterAll(() => {
  // Remove the temp DB plus any WAL/SHM/journal sidecar files.
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const f = `${dbPath}${suffix}`;
    if (existsSync(f)) rmSync(f, { force: true });
  }
});

describe("ensureDuesForPeriod", () => {
  const PERIOD = "2026-07";
  const inactiveId = "inactive-1";

  beforeAll(() => {
    const { users } = schema;
    // 3 active members + 1 inactive member.
    db.insert(users)
      .values([
        { id: "active-1", email: "a1@example.com", active: true },
        { id: "active-2", email: "a2@example.com", active: true },
        { id: "active-3", email: "a3@example.com", active: true },
      ])
      .run();
    db.insert(users)
      .values({ id: inactiveId, email: "inactive@example.com", active: false })
      .run();
  });

  it("creates one pending due per active member and is idempotent", () => {
    const { payments } = schema;

    // First call: one row per active member (3).
    expect(ensureDuesForPeriod(PERIOD)).toBe(3);

    // Second call: nothing new (onConflictDoNothing on (memberId, period)).
    expect(ensureDuesForPeriod(PERIOD)).toBe(0);

    // Exactly 3 rows exist for the period, no duplicates.
    const rows = db
      .select()
      .from(payments)
      .where(eq(payments.period, PERIOD))
      .all();
    expect(rows).toHaveLength(3);
  });

  it("sets amount, currency and status correctly on each created row", () => {
    const { payments } = schema;
    const rows = db
      .select()
      .from(payments)
      .where(eq(payments.period, PERIOD))
      .all();

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.amount).toBe(MONTHLY_DUES_MINOR);
      expect(row.currency).toBe("ILS");
      expect(row.status).toBe("pending");
    }
  });

  it("does not create dues for inactive members", () => {
    const { payments } = schema;
    const inactiveRows = db
      .select()
      .from(payments)
      .where(eq(payments.memberId, inactiveId))
      .all();
    expect(inactiveRows).toHaveLength(0);
  });
});

describe("attendance upsert", () => {
  const sessionId = "sess-1";
  const memberId = "att-member-1";

  beforeAll(() => {
    const { users, trainingSessions } = schema;
    // FKs require the user + training session to exist first
    // (PRAGMA foreign_keys = ON in src/db/index.ts).
    db.insert(users)
      .values({ id: memberId, email: "att@example.com", active: true })
      .run();
    db.insert(trainingSessions)
      .values({ id: sessionId, date: new Date(2026, 6, 1) })
      .run();
  });

  it("upserts a single row per (sessionId, memberId) pair", () => {
    const { attendance } = schema;

    db.insert(attendance)
      .values({ sessionId, memberId, rsvp: "yes" })
      .run();

    db.insert(attendance)
      .values({ sessionId, memberId, rsvp: "no" })
      .onConflictDoUpdate({
        target: [attendance.sessionId, attendance.memberId],
        set: { rsvp: "no" },
      })
      .run();

    const rows = db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.sessionId, sessionId),
          eq(attendance.memberId, memberId),
        ),
      )
      .all();

    expect(rows).toHaveLength(1);
    expect(rows[0].rsvp).toBe("no");
  });
});

describe("markPaymentPaid / getPaymentForMember", () => {
  const memberId = "pay-member-1";
  const otherMemberId = "pay-member-2";
  const paymentId = "payment-1";

  beforeAll(() => {
    const { users, payments } = schema;
    db.insert(users)
      .values([
        { id: memberId, email: "pay1@example.com", active: true },
        { id: otherMemberId, email: "pay2@example.com", active: true },
      ])
      .run();
    db.insert(payments)
      .values({
        id: paymentId,
        memberId,
        period: "2026-08",
        status: "pending",
      })
      .run();
  });

  it("marks a pending payment as paid with paidAt set", () => {
    const { payments } = schema;

    const before = db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .get();
    expect(before?.status).toBe("pending");
    expect(before?.paidAt).toBeNull();

    markPaymentPaid(paymentId, { stripePaymentIntentId: "pi_test_123" });

    const after = db
      .select()
      .from(payments)
      .where(eq(payments.id, paymentId))
      .get();
    expect(after?.status).toBe("paid");
    expect(after?.paidAt).toBeInstanceOf(Date);
    expect(after?.stripePaymentIntentId).toBe("pi_test_123");
  });

  it("returns the payment only for the correct member", () => {
    const owned = getPaymentForMember(paymentId, memberId);
    expect(owned?.id).toBe(paymentId);
    expect(owned?.memberId).toBe(memberId);

    const notOwned = getPaymentForMember(paymentId, otherMemberId);
    expect(notOwned).toBeUndefined();
  });
});
