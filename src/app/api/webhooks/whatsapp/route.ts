import type { NextRequest } from "next/server";
import { isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users, attendance } from "@/db/schema";
import { normalizePhoneDigits, parseRsvpButtonId } from "@/lib/whatsapp";

// Meta webhook verification handshake.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

function findMemberIdByPhone(fromDigits: string): string | null {
  const candidates = db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(isNotNull(users.phone))
    .all();
  const match = candidates.find(
    (c) => c.phone && normalizePhoneDigits(c.phone) === fromDigits,
  );
  return match?.id ?? null;
}

// Inbound messages — we care about RSVP button replies.
export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  try {
    const entries =
      (payload as { entry?: WhatsappEntry[] }).entry ?? ([] as WhatsappEntry[]);
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          if (
            msg.type !== "interactive" ||
            msg.interactive?.type !== "button_reply"
          ) {
            continue;
          }
          const fromDigits = normalizePhoneDigits(msg.from ?? "");
          const parsed = parseRsvpButtonId(
            msg.interactive.button_reply?.id ?? "",
          );
          if (!fromDigits || !parsed) continue;

          const memberId = findMemberIdByPhone(fromDigits);
          if (!memberId) continue;

          db.insert(attendance)
            .values({
              sessionId: parsed.sessionId,
              memberId,
              rsvp: parsed.value,
              respondedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [attendance.sessionId, attendance.memberId],
              set: { rsvp: parsed.value, respondedAt: new Date() },
            })
            .run();
        }
      }
    }
  } catch {
    // Swallow errors so Meta doesn't retry indefinitely.
  }

  // Always 200 so Meta marks the event delivered.
  return new Response("ok", { status: 200 });
}

type WhatsappEntry = {
  changes?: {
    value?: {
      messages?: {
        from?: string;
        type?: string;
        interactive?: {
          type?: string;
          button_reply?: { id?: string; title?: string };
        };
      }[];
    };
  }[];
};
