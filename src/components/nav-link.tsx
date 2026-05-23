"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Section roots are matched exactly so they don't highlight on every sub-page.
const SECTION_ROOTS = new Set(["/admin", "/me"]);

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();

  const isSectionRoot = SECTION_ROOTS.has(href);
  const isActive =
    pathname === href ||
    (!isSectionRoot && pathname.startsWith(href + "/"));

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
        isActive
          ? "bg-gray-100 font-medium text-gray-900"
          : "text-gray-600 hover:bg-gray-100",
      )}
    >
      {label}
    </Link>
  );
}
