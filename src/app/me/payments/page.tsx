import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { isStripeConfigured } from "@/lib/stripe";
import { PageHeading } from "@/components/app-shell";
import { Badge, Button, Card, CardBody } from "@/components/ui";
import { formatPeriod } from "@/lib/period";
import { formatILS } from "@/lib/utils";
import { startCheckout } from "./actions";

export default async function MemberPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; canceled?: string; error?: string }>;
}) {
  const user = await requireUser();
  const { paid, canceled, error } = await searchParams;

  const rows = db
    .select()
    .from(payments)
    .where(eq(payments.memberId, user.id))
    .orderBy(desc(payments.period))
    .all();

  const stripeOn = isStripeConfigured();

  return (
    <>
      <PageHeading title="My payments" />

      {paid && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Payment received — thank you!
        </p>
      )}
      {canceled && (
        <p className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          Checkout canceled. You can try again anytime.
        </p>
      )}
      {error === "stripe" && (
        <p className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          Online payment isn&apos;t set up yet. Please pay the admin directly.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">
          No dues yet. They&apos;ll appear here once the admin generates them.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {formatPeriod(p.period)}
                  </p>
                  <p className="text-sm text-gray-500">{formatILS(p.amount)}</p>
                </div>
                <div className="flex items-center gap-3">
                  {p.status === "paid" ? (
                    <Badge tone="green">paid</Badge>
                  ) : (
                    <>
                      <Badge tone="yellow">{p.status}</Badge>
                      {stripeOn && (
                        <form action={startCheckout}>
                          <input type="hidden" name="paymentId" value={p.id} />
                          <Button type="submit">
                            Pay {formatILS(p.amount)}
                          </Button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
