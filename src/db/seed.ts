import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL is not set; cannot seed the first admin.");
  }

  const existing = db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .get();

  if (existing) {
    if (existing.role !== "admin") {
      db.update(users)
        .set({ role: "admin", active: true })
        .where(eq(users.id, existing.id))
        .run();
      console.log(`Promoted existing user ${adminEmail} to admin.`);
    } else {
      console.log(`Admin ${adminEmail} already exists; nothing to do.`);
    }
    return;
  }

  db.insert(users)
    .values({
      email: adminEmail,
      name: "Admin",
      role: "admin",
      active: true,
    })
    .run();
  console.log(`Seeded admin: ${adminEmail}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
