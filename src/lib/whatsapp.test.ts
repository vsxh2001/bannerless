import { describe, expect, it } from "vitest";
import {
  buildRsvpButtonsPayload,
  normalizePhoneDigits,
  parseRsvpButtonId,
  rsvpButtonId,
} from "./whatsapp";

describe("whatsapp", () => {
  it("strips non-digits from phone numbers", () => {
    expect(normalizePhoneDigits("+972 50-000 0001")).toBe("972500000001");
    expect(normalizePhoneDigits("(972) 50.000.0002")).toBe("972500000002");
  });

  it("round-trips RSVP button ids", () => {
    const id = rsvpButtonId("yes", "abc-123-def");
    expect(id).toBe("rsvp_yes_abc-123-def");
    expect(parseRsvpButtonId(id)).toEqual({
      value: "yes",
      sessionId: "abc-123-def",
    });
  });

  it("returns null for unrecognized button ids", () => {
    expect(parseRsvpButtonId("not-an-rsvp")).toBeNull();
    expect(parseRsvpButtonId("rsvp_bogus_x")).toBeNull();
  });

  it("builds an interactive payload with three reply buttons", () => {
    const payload = buildRsvpButtonsPayload("+972500000001", "Coming?", "s1");
    expect(payload.to).toBe("972500000001");
    expect(payload.type).toBe("interactive");
    const buttons = payload.interactive.action.buttons;
    expect(buttons).toHaveLength(3);
    expect(buttons.map((b) => b.reply.id)).toEqual([
      "rsvp_yes_s1",
      "rsvp_maybe_s1",
      "rsvp_no_s1",
    ]);
  });
});
