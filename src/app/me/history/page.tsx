import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { trainingSessions, attendance } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeading } from "@/components/app-shell";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";

const rsvpTone = {
  yes: "green",
  no: "red",
  maybe: "yellow",
} as const;

export default async function MemberHistoryPage() {
  const user = await requireUser();

  const rows = db
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
      eq(trainingSessions.id, attendance.sessionId),
    )
    .where(
      and(
        eq(attendance.memberId, user.id),
        lt(trainingSessions.date, new Date()),
      ),
    )
    .orderBy(desc(trainingSessions.date))
    .all();

  const attended = rows.filter((r) => r.attended).length;

  return (
    <>
      <PageHeading title="My attendance history" />

      {rows.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-gray-500">
            You don&apos;t have any past sessions yet. Once you&apos;ve been to a
            session it will show up here.
          </CardBody>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Past sessions</h2>
            <p className="text-sm text-gray-500">
              Attended {attended} of {rows.length} past session
              {rows.length === 1 ? "" : "s"}.
            </p>
          </CardHeader>
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
              {rows.map((r) => (
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
                      <span className="text-gray-400">no reply</span>
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
        </Card>
      )}
    </>
  );
}
