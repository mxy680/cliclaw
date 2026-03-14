"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { SignOutButton } from "@/components/auth/sign-out-button";

const navLinks = [
  { href: "/agents", label: "Agents" },
  { href: "/jobs", label: "Jobs" },
  { href: "/integrations", label: "Integrations" },
];

export function NavSidebar() {
  const pathname = usePathname();
  const { email, isAdmin } = useSession();

  const links = isAdmin
    ? [...navLinks, { href: "/admin", label: "Admin" }]
    : navLinks;

  return (
    <aside className="hidden lg:flex w-60 fixed inset-y-0 left-0 z-30 flex-col border-r border-border bg-card">
      <div className="p-4 border-b border-border">
        <Link href="/agents" className="font-mono text-lg font-bold text-amber">
          cliclaw
        </Link>
      </div>

      <nav className="flex-1 py-4">
        {links.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center px-4 py-2 text-sm font-mono transition-colors ${
                isActive
                  ? "text-amber bg-amber/5 border-l-2 border-amber"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50 border-l-2 border-transparent"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground truncate mb-2">{email}</p>
        <SignOutButton />
      </div>
    </aside>
  );
}
