"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendance, trainingSessions } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";

export async function rsvp(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const value = String(formData.get("rsvp") ?? "");
  if (!sessionId || !["yes", "no", "maybe"].includes(value)) return;

  // Don't accept RSVPs for missing or cancelled sessions.
  const session = db
    .select({ status: trainingSessions.status })
    .from(trainingSessions)
    .where(eq(trainingSessions.id, sessionId))
    .get();
  if (!session || session.status === "cancelled") return;

  const rsvpValue = value as "yes" | "no" | "maybe";
  db.insert(attendance)
    .values({
      sessionId,
      memberId: user.id,
      rsvp: rsvpValue,
      respondedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [attendance.sessionId, attendance.memberId],
      set: { rsvp: rsvpValue, respondedAt: new Date() },
    })
    .run();

  revalidatePath("/me");
}
