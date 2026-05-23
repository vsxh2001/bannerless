"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { payments, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  ensureDuesForPeriod,
  markPaymentPaid,
  MONTHLY_DUES_MINOR,
} from "@/lib/payments";
import { isWhatsappConfigured, sendText } from "@/lib/whatsapp";
import { paymentReminderText } from "@/lib/messages";

const PERIOD_RE = /^\d{4}-\d{2}$/;

export async function generateDues(formData: FormData): Promise<void> {
  await requireAdmin();
  const period = String(formData.get("period") ?? "");
  if (!PERIOD_RE.test(period)) return;
  ensureDuesForPeriod(period);
  revalidatePath("/admin/payments");
}

export async function markPaidManual(formData: FormData): Promise<void> {
  await requireAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return;
  markPaymentPaid(paymentId);
  revalidatePath("/admin/payments");
}

export async function markPending(formData: FormData): Promise<void> {
  await requireAdmin();
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return;
  db.update(payments)
    .set({ status: "pending", paidAt: null })
    .where(eq(payments.id, paymentId))
    .run();
  revalidatePath("/admin/payments");
}

export async function sendPaymentReminders(formData: FormData): Promise<void> {
  await requireAdmin();
  const period = String(formData.get("period") ?? "");
  if (!PERIOD_RE.test(period)) redirect("/admin/payments");
  if (!isWhatsappConfigured()) {
    redirect(`/admin/payments?period=${period}&wa=notconfigured`);
  }

  const members = db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(and(eq(users.active, true), isNotNull(users.phone)))
    .all();
  const paidIds = new Set(
    db
      .select({ memberId: payments.memberId })
      .from(payments)
      .where(and(eq(payments.period, period), eq(payments.status, "paid")))
      .all()
      .map((p) => p.memberId),
  );

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const body = paymentReminderText({
    period,
    amount: MONTHLY_DUES_MINOR,
    payUrl: `${base}/me/payments`,
  });

  let sent = 0;
  let failed = 0;
  for (const m of members) {
    if (!m.phone || paidIds.has(m.id)) continue;
    try {
      await sendText(m.phone, body);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  redirect(`/admin/payments?period=${period}&wa=sent&sent=${sent}&failed=${failed}`);
}
