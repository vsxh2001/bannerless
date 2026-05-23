import { notFound } from "next/navigation";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, trainingSessions, attendance, payments } from "@/db/schema";
import { PageHeading } from "@/components/app-shell";
import { Badge, Card, CardHeader } from "@/components/ui";
import { formatDateTime, formatILS } from "@/lib/utils";
import { formatPeriod } from "@/lib/period";

const rsvpTone = {
  yes: "green",
  no: "red",
  maybe: "yellow",
} as const;

export default async function MemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const member = db.select().from(users).where(eq(users.id, id)).get();
  if (!member) notFound();

  const attendanceRows = db
    .select({
      sessionId: trainingSessions.id,
      date: trainingSessions.date,
      location: trainingSessions.location,
      rsvp: attendance.rsvp,
      attended: attendance.attended,
    })
    .from(attendance)
    .innerJoin(
      trainingSessions,
      eq(attendance.sessionId, trainingSessions.id),
    )
    .where(eq(attendance.memberId, id))
    .orderBy(desc(trainingSessions.date))
    .all();

  const paymentRows = db
    .select()
    .from(payments)
    .where(eq(payments.memberId, id))
    .orderBy(desc(payments.period))
    .all();

  return (
    <>
      <PageHeading
        title={member.name ?? member.email ?? "Member"}
        action={
          <Link
            href="/admin/members"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← All members
          </Link>
        }
      />

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Email:</span>{" "}
                {member.email ?? "—"}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Phone:</span>{" "}
                {member.phone ?? "—"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={member.role === "admin" ? "indigo" : "gray"}>
                {member.role}
              </Badge>
              <Badge tone={member.active ? "green" : "red"}>
                {member.active ? "active" : "inactive"}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Attendance history</h2>
          </CardHeader>
          {attendanceRows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">
              No attendance records yet.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Session</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">RSVP</th>
                  <th className="px-4 py-3 font-medium">Attended</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((r) => (
                  <tr key={r.sessionId} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatDateTime(r.date)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.location ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {r.rsvp ? (
                        <Badge tone={rsvpTone[r.rsvp]}>{r.rsvp}</Badge>
                      ) : (
                        <span className="text-gray-400">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.attended ? (
                        <Badge tone="green">present</Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Payment history</h2>
          </CardHeader>
          {paymentRows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">
              No payment records yet.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                </tr>
              </thead>
              <tbody>
                {paymentRows.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {formatPeriod(p.period)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatILS(p.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={p.status === "paid" ? "green" : "yellow"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.paidAt ? formatDateTime(p.paidAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
