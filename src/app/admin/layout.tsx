import { requireAdmin } from "@/lib/auth-helpers";
import { AppShell, type NavItem } from "@/components/app-shell";

const nav: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/sessions", label: "Sessions" },
  { href: "/admin/payments", label: "Payments" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  return (
    <AppShell nav={nav} userEmail={user.email}>
      {children}
    </AppShell>
  );
}
