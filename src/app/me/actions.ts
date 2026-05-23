"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { attendance } from "@/db/schema";
import { requireUser } from "@/lib/auth-helpers";

export async function rsvp(formData: FormData): Promise<void> {
  const user = await requireUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const value = String(formData.get("rsvp") ?? "");
  if (!sessionId || !["yes", "no", "maybe"].includes(value)) return;

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
