"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { SignOutButton } from "@/components/auth/sign-out-button";

const navLinks = [
  { href: "/agents", label: "Agents" },
  { href: "/jobs", label: "Jobs" },
  { href: "/integrations", label: "Integrations" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { email, isAdmin } = useSession();

  const links = isAdmin
    ? [...navLinks, { href: "/admin", label: "Admin" }]
    : navLinks;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
        aria-label="Open navigation"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-60 bg-card border-r border-border flex flex-col animate-fade-in-up">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <span className="font-mono text-lg font-bold text-amber">
                cliclaw
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 py-4">
              {links.map((link) => {
                const isActive =
                  pathname === link.href ||
                  pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center px-4 py-2 text-sm font-mono transition-colors ${
                      isActive
                        ? "text-amber bg-amber/5 border-l-2 border-amber"
                        : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-border">
              <p className="text-xs text-muted-foreground truncate mb-2">
                {email}
              </p>
              <SignOutButton />
            </div>
          </div>
        </>
      )}
    </>
  );
}
