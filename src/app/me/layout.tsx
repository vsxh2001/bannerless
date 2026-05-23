import { requireUser } from "@/lib/auth-helpers";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { href: "/me", label: "My sessions" },
  { href: "/me/payments", label: "My payments" },
];

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <AppShell nav={nav} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
