"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { trainingSessions, attendance, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";
import {
  isWhatsappConfigured,
  sendRsvpButtons,
  sendText,
} from "@/lib/whatsapp";
import { sessionReminderText, participantsSummaryText } from "@/lib/messages";

export type ActionResult = { ok: boolean; error?: string };

const createSchema = z.object({
  date: z.string().min(1, "Date & time are required"),
  location: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function createSession(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse({
    date: formData.get("date"),
    location: formData.get("location") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const date = new Date(parsed.data.date);
  if (Number.isNaN(date.getTime())) {
    return { ok: false, error: "Invalid date" };
  }
  db.insert(trainingSessions)
    .values({ date, location: parsed.data.location, notes: parsed.data.notes })
    .run();
  revalidatePath("/admin/sessions");
  return { ok: true };
}

export async function generateWeekly(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const start = new Date(String(formData.get("start") ?? ""));
  const count = Number(formData.get("count") ?? 0);
  const location = String(formData.get("location") ?? "").trim() || null;
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "Invalid start date" };
  }
  if (!Number.isInteger(count) || count < 1 || count > 52) {
    return { ok: false, error: "Count must be between 1 and 52" };
  }
  const rows = Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 7 * i);
    return { date: d, location };
  });
  db.insert(trainingSessions).values(rows).run();
  revalidatePath("/admin/sessions");
  return { ok: true };
}

export async function setSessionStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["scheduled", "done", "cancelled"].includes(status)) return;
  db.update(trainingSessions)
    .set({ status: status as "scheduled" | "done" | "cancelled" })
    .where(eq(trainingSessions.id, id))
    .run();
  revalidatePath("/admin/sessions");
  revalidatePath(`/admin/sessions/${id}`);
}

export async function deleteSession(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  db.delete(trainingSessions).where(eq(trainingSessions.id, id)).run();
  revalidatePath("/admin/sessions");
  redirect("/admin/sessions");
}

export async function setAttended(formData: FormData): Promise<void> {
  await requireAdmin();
  const sessionId = String(formData.get("sessionId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const attended = String(formData.get("attended") ?? "") === "true";
  if (!sessionId || !memberId) return;
  db.insert(attendance)
    .values({ sessionId, memberId, attended })
    .onConflictDoUpdate({
      target: [attendance.sessionId, attendance.memberId],
      set: { attended },
    })
    .run();
  revalidatePath(`/admin/sessions/${sessionId}`);
}

function activeMembersWithPhone() {
  return db
    .select({ id: users.id, name: users.name, phone: users.phone })
    .from(users)
    .where(and(eq(users.active, true), isNotNull(users.phone)))
    .all();
}

export async function sendReminder(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const session = db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .get();
  if (!session) redirect("/admin/sessions");
  if (!isWhatsappConfigured()) {
    redirect(`/admin/sessions/${id}?wa=notconfigured`);
  }

  const body = sessionReminderText({
    date: session.date,
    location: session.location,
  });
  let sent = 0;
  let failed = 0;
  for (const m of activeMembersWithPhone()) {
    if (!m.phone) continue;
    try {
      await sendRsvpButtons(m.phone, body, id);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  redirect(`/admin/sessions/${id}?wa=sent&sent=${sent}&failed=${failed}`);
}

export async function broadcastLineup(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const session = db
    .select()
    .from(trainingSessions)
    .where(eq(trainingSessions.id, id))
    .get();
  if (!session) redirect("/admin/sessions");
  if (!isWhatsappConfigured()) {
    redirect(`/admin/sessions/${id}?wa=notconfigured`);
  }

  const going = db
    .select({ name: users.name })
    .from(attendance)
    .innerJoin(users, eq(users.id, attendance.memberId))
    .where(and(eq(attendance.sessionId, id), eq(attendance.rsvp, "yes")))
    .all();
  const body = participantsSummaryText({
    date: session.date,
    location: session.location,
    going: going.map((g) => g.name ?? "Member"),
  });

  let sent = 0;
  let failed = 0;
  for (const m of activeMembersWithPhone()) {
    if (!m.phone) continue;
    try {
      await sendText(m.phone, body);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  redirect(`/admin/sessions/${id}?wa=sent&sent=${sent}&failed=${failed}`);
}
