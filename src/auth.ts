import NextAuth from "next-auth";
import ResendProvider from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

const resend = ResendProvider({
  apiKey: process.env.AUTH_RESEND_KEY || "dev-no-key",
  from: process.env.EMAIL_FROM || "Bannerless <onboarding@resend.dev>",
  async sendVerificationRequest({ identifier, url }) {
    if (!process.env.AUTH_RESEND_KEY) {
      // Dev fallback: print the magic link so login works without Resend.
      console.log("\n=== Magic-link login (dev, no AUTH_RESEND_KEY) ===");
      console.log(`To:  ${identifier}`);
      console.log(`URL: ${url}\n`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.AUTH_RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: identifier,
        subject: "Your Bannerless sign-in link",
        html: `<p>Click below to sign in to Bannerless:</p>
               <p><a href="${url}">Sign in</a></p>
               <p>If you didn't request this, you can ignore this email.</p>`,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    }
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [resend],
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  callbacks: {
    // Closed group: only pre-registered, active members may sign in.
    async signIn({ user }) {
      const email = user?.email;
      if (!email) return false;
      const existing = db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .get();
      return Boolean(existing && existing.active);
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as typeof users.$inferSelect).role;
        session.user.phone = (user as typeof users.$inferSelect).phone;
      }
      return session;
    },
  },
});
