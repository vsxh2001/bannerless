// Meta WhatsApp Cloud API client + payload builders.
//
// Constraints (see README): the Cloud API sends 1:1 messages to individual
// numbers, never to WhatsApp *groups*. Free-form text and interactive button
// messages only deliver inside the 24h customer-service window (i.e. after the
// member has messaged the business number). For proactive, business-initiated
// sends outside that window, an approved message *template* is required.

const GRAPH_VERSION = "v21.0";

export type RsvpValue = "yes" | "no" | "maybe";

export function isWhatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function rsvpButtonId(value: RsvpValue, sessionId: string): string {
  return `rsvp_${value}_${sessionId}`;
}

export function parseRsvpButtonId(
  id: string,
): { value: RsvpValue; sessionId: string } | null {
  const match = /^rsvp_(yes|no|maybe)_(.+)$/.exec(id);
  if (!match) return null;
  return { value: match[1] as RsvpValue, sessionId: match[2] };
}

export function buildTextPayload(to: string, body: string) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhoneDigits(to),
    type: "text",
    text: { preview_url: true, body },
  };
}

export function buildRsvpButtonsPayload(
  to: string,
  body: string,
  sessionId: string,
) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizePhoneDigits(to),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: rsvpButtonId("yes", sessionId), title: "Going" },
          },
          {
            type: "reply",
            reply: { id: rsvpButtonId("maybe", sessionId), title: "Maybe" },
          },
          {
            type: "reply",
            reply: { id: rsvpButtonId("no", sessionId), title: "Can't" },
          },
        ],
      },
    },
  };
}

async function send(payload: object): Promise<void> {
  if (!isWhatsappConfigured()) {
    throw new Error("WhatsApp is not configured");
  }
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`WhatsApp send failed (${res.status}): ${await res.text()}`);
  }
}

export async function sendText(to: string, body: string): Promise<void> {
  await send(buildTextPayload(to, body));
}

export async function sendRsvpButtons(
  to: string,
  body: string,
  sessionId: string,
): Promise<void> {
  await send(buildRsvpButtonsPayload(to, body, sessionId));
}
