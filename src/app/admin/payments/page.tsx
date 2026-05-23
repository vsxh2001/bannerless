import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { payments, users } from "@/db/schema";
import { PageHeading } from "@/components/app-shell";
import { Badge, Button, Card, CardBody } from "@/components/ui";
import { currentPeriod, formatPeriod, recentPeriods } from "@/lib/period";
import { formatILS } from "@/lib/utils";
import { MONTHLY_DUES_MINOR } from "@/lib/payments";
import {
  generateDues,
  markPaidManual,
  markPending,
  sendPaymentReminders,
} from "./actions";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    wa?: string;
    sent?: string;
    failed?: string;
  }>;
}) {
  const { period: rawPeriod, wa, sent, failed } = await searchParams;
  const period = /^\d{4}-\d{2}$/.test(rawPeriod ?? "")
    ? (rawPeriod as string)
    : currentPeriod();

  const members = db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.name))
    .all();

  const periodPayments = db
    .select()
    .from(payments)
    .where(eq(payments.period, period))
    .all();
  const byMember = new Map(periodPayments.map((p) => [p.memberId, p]));

  const paidCount = members.filter(
    (m) => byMember.get(m.id)?.status === "paid",
  ).length;
  const collected = periodPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const outstanding = (members.length - paidCount) * MONTHLY_DUES_MINOR;

  const options = recentPeriods(6);

  return (
    <>
      <PageHeading
        title="Payments"
        action={
          <form action={sendPaymentReminders}>
            <input type="hidden" name="period" value={period} />
            <Button type="submit" variant="secondary">
              Send reminders to unpaid
            </Button>
          </form>
        }
      />

      {wa === "sent" && (
        <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          WhatsApp reminders sent to {sent ?? 0} member(s)
          {Number(failed) > 0 ? `, ${failed} failed` : ""}.
        </p>
      )}
      {wa === "notconfigured" && (
        <p className="mb-4 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
          WhatsApp isn&apos;t configured yet. Add the Meta Cloud API credentials
          to enable messaging.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {options.map((p) => (
          <Link
            key={p}
            href={`/admin/payments?period=${p}`}
            className={
              p === period
                ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            }
          >
            {formatPeriod(p)}
          </Link>
        ))}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Collected</p>
            <p className="text-2xl font-bold text-green-600">
              {formatILS(collected)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">
              {formatILS(outstanding)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Paid</p>
              <p className="text-2xl font-bold text-gray-900">
                {paidCount}/{members.length}
              </p>
            </div>
            <form action={generateDues}>
              <input type="hidden" name="period" value={period} />
              <Button type="submit" variant="secondary">
                Generate dues
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Member</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const p = byMember.get(m.id);
              return (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {m.name ?? m.email}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatILS(p?.amount ?? MONTHLY_DUES_MINOR)}
                  </td>
                  <td className="px-4 py-3">
                    {!p ? (
                      <span className="text-gray-400">not generated</span>
                    ) : p.status === "paid" ? (
                      <Badge tone="green">paid</Badge>
                    ) : (
                      <Badge tone="yellow">{p.status}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p && p.status === "paid" ? (
                      <form action={markPending}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <Button type="submit" variant="ghost">
                          Mark unpaid
                        </Button>
                      </form>
                    ) : p ? (
                      <form action={markPaidManual}>
                        <input type="hidden" name="paymentId" value={p.id} />
                        <Button type="submit" variant="secondary">
                          Mark paid
                        </Button>
                      </form>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
