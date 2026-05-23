import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, users } from "@/db/schema";

export const MONTHLY_DUES_MINOR = 5000; // 50.00 ILS, in agorot

// Idempotently create a pending payment row for every active member for a period.
// Returns the number of new rows created.
export function ensureDuesForPeriod(period: string): number {
  const activeMembers = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.active, true))
    .all();

  let created = 0;
  for (const m of activeMembers) {
    const res = db
      .insert(payments)
      .values({
        memberId: m.id,
        period,
        amount: MONTHLY_DUES_MINOR,
        currency: "ILS",
        status: "pending",
      })
      .onConflictDoNothing({
        target: [payments.memberId, payments.period],
      })
      .run();
    created += res.changes;
  }
  return created;
}

export function markPaymentPaid(
  paymentId: string,
  opts: { stripePaymentIntentId?: string | null } = {},
): void {
  db.update(payments)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: opts.stripePaymentIntentId ?? undefined,
    })
    .where(eq(payments.id, paymentId))
    .run();
}

export function markPaidByCheckoutSession(
  checkoutSessionId: string,
  stripePaymentIntentId?: string | null,
): void {
  db.update(payments)
    .set({
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: stripePaymentIntentId ?? undefined,
    })
    .where(eq(payments.stripeCheckoutSessionId, checkoutSessionId))
    .run();
}

export function getPaymentForMember(paymentId: string, memberId: string) {
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.memberId, memberId)))
    .get();
}
