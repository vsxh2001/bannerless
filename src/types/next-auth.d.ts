import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "member";
      phone?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "member";
    phone?: string | null;
    active: boolean;
  }
}
