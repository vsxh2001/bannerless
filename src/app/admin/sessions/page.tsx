import Link from "next/link";
import { asc, desc, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { trainingSessions, attendance } from "@/db/schema";
import { PageHeading } from "@/components/app-shell";
import { Badge, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { CreateSessionForm, GenerateWeeklyForm } from "./sessions-client";

type Counts = { going: number; attended: number };

function statusTone(status: string) {
  if (status === "done") return "green" as const;
  if (status === "cancelled") return "red" as const;
  return "indigo" as const;
}

function SessionTable({
  rows,
  counts,
  empty,
}: {
  rows: (typeof trainingSessions.$inferSelect)[];
  counts: Map<string, Counts>;
  empty: string;
}) {
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Going</th>
            <th className="px-4 py-3 font-medium">Attended</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((s) => {
              const c = counts.get(s.id) ?? { going: 0, attended: 0 };
              return (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {formatDateTime(s.date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.location ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.going}</td>
                  <td className="px-4 py-3 text-gray-600">{c.attended}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/sessions/${s.id}`}
                      className="text-sm font-medium text-indigo-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </Card>
  );
}

export default async function SessionsPage() {
  const now = new Date();
  const upcoming = db
    .select()
    .from(trainingSessions)
    .where(gte(trainingSessions.date, now))
    .orderBy(asc(trainingSessions.date))
    .all();
  const past = db
    .select()
    .from(trainingSessions)
    .where(lt(trainingSessions.date, now))
    .orderBy(desc(trainingSessions.date))
    .all();

  const aggRows = db
    .select({
      sessionId: attendance.sessionId,
      going: sql<number>`sum(case when ${attendance.rsvp} = 'yes' then 1 else 0 end)`,
      attended: sql<number>`sum(case when ${attendance.attended} = 1 then 1 else 0 end)`,
    })
    .from(attendance)
    .groupBy(attendance.sessionId)
    .all();
  const counts = new Map(
    aggRows.map((r) => [
      r.sessionId,
      { going: Number(r.going), attended: Number(r.attended) },
    ]),
  );

  return (
    <>
      <PageHeading title="Sessions" />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <CreateSessionForm />
          <GenerateWeeklyForm />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Upcoming
          </h2>
          <SessionTable
            rows={upcoming}
            counts={counts}
            empty="No upcoming sessions."
          />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Past
          </h2>
          <SessionTable rows={past} counts={counts} empty="No past sessions." />
        </div>
      </div>
    </>
  );
}
