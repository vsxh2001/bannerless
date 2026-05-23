import { formatDateTime, formatILS } from "./utils";
import { formatPeriod } from "./period";

export function sessionReminderText(opts: {
  date: Date;
  location?: string | null;
}): string {
  const where = opts.location ? ` at ${opts.location}` : "";
  return `Training on ${formatDateTime(opts.date)}${where}. Are you coming?`;
}

export function participantsSummaryText(opts: {
  date: Date;
  location?: string | null;
  going: string[];
}): string {
  const where = opts.location ? ` at ${opts.location}` : "";
  const list = opts.going.length
    ? opts.going.map((n) => `- ${n}`).join("\n")
    : "Nobody has confirmed yet.";
  return `Lineup for ${formatDateTime(opts.date)}${where} (${opts.going.length} going):\n${list}`;
}

export function paymentReminderText(opts: {
  period: string;
  amount: number;
  payUrl?: string;
}): string {
  const base = `Reminder: ${formatPeriod(opts.period)} training dues are ${formatILS(opts.amount)}.`;
  return opts.payUrl
    ? `${base}\nPay here: ${opts.payUrl}`
    : `${base}\nPlease settle with the admin.`;
}
