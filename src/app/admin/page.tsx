import Link from "next/link";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingSessions, attendance, payments, users } from "@/db/schema";
import { PageHeading } from "@/components/app-shell";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { currentPeriod, formatPeriod } from "@/lib/period";
import { formatDateTime, formatILS } from "@/lib/utils";
import { MONTHLY_DUES_MINOR } from "@/lib/payments";
import { generateDues } from "./payments/actions";

export default async function AdminOverviewPage() {
  const now = new Date();
  const period = currentPeriod();

  const activeCount = db
    .select({ c: sql<number>`count(*)` })
    .from(users)
    .where(eq(users.active, true))
    .get();
  const memberCount = Number(activeCount?.c ?? 0);

  const nextSession = db
    .select()
    .from(trainingSessions)
    .where(
      and(
        gte(trainingSessions.date, now),
        eq(trainingSessions.status, "scheduled"),
      ),
    )
    .orderBy(asc(trainingSessions.date))
    .limit(1)
    .get();

  let going = 0;
  if (nextSession) {
    const r = db
      .select({ c: sql<number>`count(*)` })
      .from(attendance)
      .where(
        and(
          eq(attendance.sessionId, nextSession.id),
          eq(attendance.rsvp, "yes"),
        ),
      )
      .get();
    going = Number(r?.c ?? 0);
  }

  const upcomingRow = db
    .select({ c: sql<number>`count(*)` })
    .from(trainingSessions)
    .where(
      and(
        gte(trainingSessions.date, now),
        eq(trainingSessions.status, "scheduled"),
      ),
    )
    .get();
  const upcomingCount = Number(upcomingRow?.c ?? 0);

  const recentPastSessions = db
    .select({ id: trainingSessions.id })
    .from(trainingSessions)
    .where(lt(trainingSessions.date, now))
    .orderBy(desc(trainingSessions.date))
    .limit(5)
    .all();
  let avgAttendance = "—";
  if (recentPastSessions.length > 0) {
    const ids = recentPastSessions.map((s) => s.id);
    const attendedRow = db
      .select({ c: sql<number>`count(*)` })
      .from(attendance)
      .where(
        and(
          inArray(attendance.sessionId, ids),
          eq(attendance.attended, true),
        ),
      )
      .get();
    const totalAttended = Number(attendedRow?.c ?? 0);
    avgAttendance = (totalAttended / recentPastSessions.length).toFixed(1);
  }

  const periodPayments = db
    .select()
    .from(payments)
    .where(eq(payments.period, period))
    .all();
  const paidCount = periodPayments.filter((p) => p.status === "paid").length;
  const collected = periodPayments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const outstanding = (memberCount - paidCount) * MONTHLY_DUES_MINOR;

  return (
    <>
      <PageHeading title="Overview" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active members", value: String(memberCount) },
          { label: "Upcoming sessions", value: String(upcomingCount) },
          { label: "Avg attendance (last 5)", value: avgAttendance },
          { label: "Paid this month", value: `${paidCount}/${memberCount}` },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {stat.value}
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Next session</h2>
          </CardHeader>
          <CardBody>
            {nextSession ? (
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">
                  {formatDateTime(nextSession.date)}
                </p>
                <p className="text-sm text-gray-500">
                  {nextSession.location ?? "Location TBD"}
                </p>
                <p className="text-sm text-gray-600">
                  <Badge tone="green">{going} going</Badge> of {memberCount}{" "}
                  members
                </p>
                <Link
                  href={`/admin/sessions/${nextSession.id}`}
                  className="inline-block text-sm font-medium text-indigo-600 hover:underline"
                >
                  Manage session →
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-gray-500">
                  No upcoming session scheduled.
                </p>
                <Link
                  href="/admin/sessions"
                  className="inline-block text-sm font-medium text-indigo-600 hover:underline"
                >
                  Schedule one →
                </Link>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-gray-900">
              {formatPeriod(period)} dues
            </h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Collected</span>
              <span className="font-semibold text-green-600">
                {formatILS(collected)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Outstanding</span>
              <span className="font-semibold text-red-600">
                {formatILS(outstanding)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Paid</span>
              <span className="font-semibold text-gray-900">
                {paidCount}/{memberCount}
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              {periodPayments.length === 0 ? (
                <form action={generateDues}>
                  <input type="hidden" name="period" value={period} />
                  <Button type="submit" variant="secondary">
                    Generate this month&apos;s dues
                  </Button>
                </form>
              ) : (
                <Link
                  href={`/admin/payments?period=${period}`}
                  className="inline-block text-sm font-medium text-indigo-600 hover:underline"
                >
                  View payments →
                </Link>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
