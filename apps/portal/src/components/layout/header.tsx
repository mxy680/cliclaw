import Link from "next/link";
import { MobileNav } from "./mobile-nav";

interface Breadcrumb {
  label: string;
  href: string;
}

interface HeaderProps {
  title: string;
  breadcrumb?: Breadcrumb[];
}

export function Header({ title, breadcrumb }: HeaderProps) {
  return (
    <header className="border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {breadcrumb?.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-2">
            <Link
              href={crumb.href}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
            <span className="text-muted-foreground/50">/</span>
          </span>
        ))}
        <h1 className="font-mono text-lg font-semibold tracking-wide">
          {title}
        </h1>
      </div>
      <MobileNav />
    </header>
  );
}
