"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-helpers";

export type ActionResult = { ok: boolean; error?: string };

const memberSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z
    .email("A valid email is required")
    .transform((e) => e.toLowerCase().trim()),
  phone: z
    .string()
    .trim()
    .transform((p) => (p === "" ? null : p))
    .nullable()
    .refine((p) => p === null || /^\+?[0-9]{7,15}$/.test(p), {
      message: "Phone must be 7–15 digits, optionally starting with +",
    }),
  role: z.enum(["admin", "member"]),
});

export async function createMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = memberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role") ?? "member",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .get();
  if (existing) {
    return { ok: false, error: "A member with that email already exists" };
  }

  db.insert(users)
    .values({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      active: true,
    })
    .run();

  revalidatePath("/admin/members");
  return { ok: true };
}

export async function updateMember(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing member id" };

  const parsed = memberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role") ?? "member",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const clash = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .get();
  if (clash && clash.id !== id) {
    return { ok: false, error: "Another member already uses that email" };
  }

  db.update(users)
    .set({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
    })
    .where(eq(users.id, id))
    .run();

  revalidatePath("/admin/members");
  return { ok: true };
}

export async function setMemberActive(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return;
  db.update(users).set({ active }).where(eq(users.id, id)).run();
  revalidatePath("/admin/members");
}
