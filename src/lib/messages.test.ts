import { describe, expect, it } from "vitest";
import {
  participantsSummaryText,
  paymentReminderText,
  sessionReminderText,
} from "./messages";

const date = new Date(2026, 4, 26, 19, 0); // Tue 26 May 2026, 19:00

describe("messages", () => {
  it("builds a session reminder with location", () => {
    const text = sessionReminderText({ date, location: "City Park" });
    expect(text).toContain("City Park");
    expect(text).toContain("Are you coming?");
  });

  it("omits location when absent", () => {
    const text = sessionReminderText({ date, location: null });
    expect(text).not.toContain(" at ");
  });

  it("lists confirmed participants and a count", () => {
    const text = participantsSummaryText({
      date,
      location: "Gym",
      going: ["Dana", "Yossi"],
    });
    expect(text).toContain("(2 going)");
    expect(text).toContain("- Dana");
    expect(text).toContain("- Yossi");
  });

  it("handles an empty lineup", () => {
    const text = participantsSummaryText({ date, location: null, going: [] });
    expect(text).toContain("(0 going)");
    expect(text).toContain("Nobody has confirmed yet.");
  });

  it("includes a pay link when provided", () => {
    const withLink = paymentReminderText({
      period: "2026-05",
      amount: 5000,
      payUrl: "https://app.example/me/payments",
    });
    expect(withLink).toContain("May 2026");
    expect(withLink).toContain("https://app.example/me/payments");

    const without = paymentReminderText({ period: "2026-05", amount: 5000 });
    expect(without).toContain("admin");
  });
});
