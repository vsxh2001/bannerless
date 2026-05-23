"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPaymentForMember } from "@/lib/payments";
import { formatPeriod } from "@/lib/period";

export async function startCheckout(formData: FormData): Promise<void> {
  const user = await requireUser();
  const paymentId = String(formData.get("paymentId") ?? "");

  const pay = getPaymentForMember(paymentId, user.id);
  if (!pay || pay.status === "paid") {
    redirect("/me/payments");
  }
  if (!isStripeConfigured()) {
    redirect("/me/payments?error=stripe");
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: pay.currency.toLowerCase(),
          unit_amount: pay.amount,
          product_data: {
            name: `Training dues — ${formatPeriod(pay.period)}`,
          },
        },
      },
    ],
    customer_email: user.email ?? undefined,
    metadata: { paymentId: pay.id },
    success_url: `${base}/me/payments?paid=1`,
    cancel_url: `${base}/me/payments?canceled=1`,
  });

  db.update(payments)
    .set({ stripeCheckoutSessionId: checkout.id })
    .where(eq(payments.id, pay.id))
    .run();

  redirect(checkout.url!);
}
