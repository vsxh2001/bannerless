import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { trainingSessions, attendance, users } from "@/db/schema";
import { PageHeading } from "@/components/app-shell";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import {
  setSessionStatus,
  deleteSession,
  setAttended,
  sendReminder,
  broadcastLineup,
} from "../actions";

const rsvpTone = {
  yes: "green",
  no: "red",
  maybe: "yellow",
} as const;

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    wa?: string;
    sent?: string;
    failed?: string;
  }>;
}) {
  const { id } = await params;
  const { wa, sent, failed } = await searchParams;

  const session = db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .get();
  if (!session) notFound();

  const roster = db
    .select({
      memberId: users.id,
      name: users.name,
      phone: users.phone,
      rsvp: attendance.rsvp,
      attended: attendance.attended,
    })
    .from(users)
    .leftJoin(
      attendance,
      and(eq(attendance.memberId, users.id), eq(attendance.sessionId, id)),
    )
    .where(eq(users.active, true))
    .orderBy(asc(users.name))
    .all();

  const going = roster.filter((r) => r.rsvp === "yes").length;
  const attended = roster.filter((r) => r.attended).length;

  return (
    <>
      <PageHeading
        title={formatDateTime(session.date)}
        action={
          <Link
            href="/admin/sessions"
            className="text-sm text-indigo-600 hover:underline"
          >
            ← All sessions
          </Link>
        }
      />

      <div className="space-y-6">
        {wa === "sent" && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            WhatsApp sent to {sent ?? 0} member(s)
            {Number(failed) > 0 ? `, ${failed} failed` : ""}.
          </p>
        )}
        {wa === "notconfigured" && (
          <p className="rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
            WhatsApp isn&apos;t configured yet. Add the Meta Cloud API
            credentials to enable messaging.
          </p>
        )}

        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">Location:</span>{" "}
                {session.location ?? "—"}
              </p>
              {session.notes && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Notes:</span>{" "}
                  {session.notes}
                </p>
              )}
              <p className="text-sm text-gray-600">
                Status: <Badge>{session.status}</Badge> · {going} going ·{" "}
                {attended} attended
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["scheduled", "done", "cancelled"] as const).map((s) => (
                <form key={s} action={setSessionStatus}>
                  <input type="hidden" name="id" value={session.id} />
                  <input type="hidden" name="status" value={s} />
                  <Button
                    type="submit"
                    variant={session.status === s ? "primary" : "secondary"}
                  >
                    {s === "scheduled"
                      ? "Scheduled"
                      : s === "done"
                        ? "Mark done"
                        : "Cancel"}
                  </Button>
                </form>
              ))}
              <form action={deleteSession}>
                <input type="hidden" name="id" value={session.id} />
                <Button type="submit" variant="danger">
                  Delete
                </Button>
              </form>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">WhatsApp:</span>
            <form action={sendReminder}>
              <input type="hidden" name="id" value={session.id} />
              <Button type="submit" variant="secondary">
                Send RSVP request
              </Button>
            </form>
            <form action={broadcastLineup}>
              <input type="hidden" name="id" value={session.id} />
              <Button type="submit" variant="secondary">
                Broadcast lineup
              </Button>
            </form>
            <span className="text-xs text-gray-400">
              Sends 1:1 messages to members with a phone number.
            </span>
          </CardBody>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <h2 className="font-semibold text-gray-900">Participants</h2>
            <p className="text-sm text-gray-500">
              RSVP comes from members; mark who actually attended.
            </p>
          </CardHeader>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">RSVP</th>
                <th className="px-4 py-3 font-medium">Attended</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.memberId} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.name ?? "—"}
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
                  <td className="px-4 py-3 text-right">
                    <form action={setAttended}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="memberId" value={r.memberId} />
                      <input
                        type="hidden"
                        name="attended"
                        value={(!r.attended).toString()}
                      />
                      <Button
                        type="submit"
                        variant={r.attended ? "ghost" : "secondary"}
                      >
                        {r.attended ? "Unmark" : "Mark present"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
