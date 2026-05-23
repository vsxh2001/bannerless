import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { trainingSessions, attendance } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeading } from "@/components/app-shell";
import { Badge, Button, Card, CardBody } from "@/components/ui";
import { formatDateTime } from "@/lib/utils";
import { rsvp } from "./actions";

const options = [
  { value: "yes", label: "Going" },
  { value: "maybe", label: "Maybe" },
  { value: "no", label: "Can't" },
] as const;

export default async function MemberHomePage() {
  const user = await requireUser();
  const now = new Date();

  const sessions = db
    .select({
      id: trainingSessions.id,
      date: trainingSessions.date,
      location: trainingSessions.location,
      notes: trainingSessions.notes,
      status: trainingSessions.status,
      rsvp: attendance.rsvp,
    })
    .from(trainingSessions)
    .leftJoin(
      attendance,
      and(
        eq(attendance.sessionId, trainingSessions.id),
        eq(attendance.memberId, user.id),
      ),
    )
    .where(gte(trainingSessions.date, now))
    .orderBy(asc(trainingSessions.date))
    .all();

  return (
    <>
      <PageHeading title="My sessions" />
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-500">No upcoming sessions scheduled.</p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardBody className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(s.date)}
                    {s.status === "cancelled" && (
                      <Badge tone="red" className="ml-2">
                        cancelled
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {s.location ?? "Location TBD"}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {options.map((o) => {
                    const active = s.rsvp === o.value;
                    return (
                      <form key={o.value} action={rsvp}>
                        <input type="hidden" name="sessionId" value={s.id} />
                        <input type="hidden" name="rsvp" value={o.value} />
                        <Button
                          type="submit"
                          variant={active ? "primary" : "secondary"}
                          disabled={s.status === "cancelled"}
                        >
                          {o.label}
                        </Button>
                      </form>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
