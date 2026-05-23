import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { markPaidByCheckoutSession, markPaymentPaid } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return new Response("Webhook not configured", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    // Guard against async/delayed methods that complete the session while
    // still unpaid — only record dues once Stripe confirms payment.
    if (session.payment_status !== "paid") {
      return new Response("ok", { status: 200 });
    }

    const paymentId = session.metadata?.paymentId;
    const intent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);

    if (paymentId) {
      markPaymentPaid(paymentId, { stripePaymentIntentId: intent });
    } else if (session.id) {
      markPaidByCheckoutSession(session.id, intent);
    }
  }

  return new Response("ok", { status: 200 });
}
