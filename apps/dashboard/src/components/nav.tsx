"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const mainItems = [
  { href: "/", label: "Overview", mono: "00" },
  { href: "/agents", label: "Agents", mono: "01" },
  { href: "/jobs", label: "Jobs", mono: "02" },
  { href: "/admin", label: "Admin", mono: "03" },
];


export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="scanlines relative w-60 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-amber animate-[glow-pulse_3s_ease-in-out_infinite]" />
          <span className="font-mono text-sm font-semibold tracking-[0.2em] uppercase text-amber">
            cliclaw
          </span>
        </div>
        <p className="font-mono text-[10px] text-muted-foreground mt-1.5 tracking-wider uppercase">
          Integration Control
        </p>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Main nav */}
      <div className="flex flex-col gap-0.5 px-3 py-4">
        {mainItems.map((item, i) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-200 animate-slide-in-left",
                active
                  ? "text-amber"
                  : "text-sidebar-foreground hover:text-foreground"
              )}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-amber" />
              )}
              <span className="font-mono text-[10px] text-muted-foreground group-hover:text-amber-dim transition-colors">
                {item.mono}
              </span>
              <span className="font-medium tracking-wide">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom status */}
      <div className="mt-auto px-5 pb-5">
        <Separator className="bg-sidebar-border mb-4" />
        <div className="flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-emerald-500" />
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider">
            SYSTEM ONLINE
          </span>
        </div>
      </div>
    </nav>
  );
}
