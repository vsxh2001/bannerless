import Link from "next/link";
import { signOut } from "@/auth";
import { Button } from "@/components/ui";
import { NavLink } from "@/components/nav-link";

export type NavItem = { href: string; label: string };

export function AppShell({
  nav,
  userEmail,
  children,
}: {
  nav: NavItem[];
  userEmail?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link href="/" className="font-bold text-gray-900">
              Bannerless
            </Link>
            <nav className="flex flex-wrap gap-1">
              {nav.map((n) => (
                <NavLink key={n.href} href={n.href} label={n.label} />
              ))}
            </nav>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            {userEmail && (
              <span className="hidden max-w-[16rem] truncate text-sm text-gray-400 sm:inline">
                {userEmail}
              </span>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <Button variant="ghost" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}

export function PageHeading({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      {action}
    </div>
  );
}
