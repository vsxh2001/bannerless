import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { payments, users } from "@/db/schema";

/**
 * Escape a value for inclusion in a CSV cell. Wraps the value in double quotes
 * and doubles any embedded double quotes, which safely handles commas, quotes
 * and newlines inside fields (e.g. member names like `O'Brien, Jr. "Bob"`,
 * which stays a single field).
 *
 * Also neutralizes spreadsheet formula injection: a field beginning with
 * `= + - @` or a control char is rendered as a live formula by Excel/Sheets,
 * so prefix those with a single quote.
 */
function csvCell(value: string | number | null | undefined): string {
  let str = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const rows = db
    .select({
      period: payments.period,
      member: users.name,
      email: users.email,
      amount: payments.amount,
      currency: payments.currency,
      status: payments.status,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .innerJoin(users, eq(payments.memberId, users.id))
    .orderBy(desc(payments.period), users.name)
    .all();

  const header = "period,member,email,amount,currency,status,paid_at";
  const lines = rows.map((r) =>
    [
      csvCell(r.period),
      csvCell(r.member),
      csvCell(r.email),
      csvCell((r.amount / 100).toFixed(2)),
      csvCell(r.currency),
      csvCell(r.status),
      csvCell(r.paidAt ? r.paidAt.toISOString() : ""),
    ].join(","),
  );
  const csv = [header, ...lines].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="payments.csv"',
    },
  });
}
