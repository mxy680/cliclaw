import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface IntegrationCardProps {
  name: string;
  href: string;
  accountCount: number;
  description: string;
}

export function IntegrationCard({ name, href, accountCount, description }: IntegrationCardProps) {
  return (
    <Link href={href} className="group block">
      <Card className="relative overflow-hidden border-border bg-card transition-all duration-300 hover:border-amber/30 hover:shadow-[0_0_30px_-10px_var(--amber-glow)]">
        {/* Left accent stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-amber/40 group-hover:bg-amber transition-colors duration-300" />

        <CardContent className="py-5 pl-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-wide text-foreground group-hover:text-amber transition-colors duration-200">
                {name}
              </h2>
              <p className="text-muted-foreground text-xs mt-1 tracking-wide">
                {description}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="font-mono text-[11px] tabular-nums bg-secondary text-secondary-foreground border-0"
            >
              {accountCount}
            </Badge>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <div className={`size-1.5 rounded-full ${accountCount > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
              {accountCount > 0 ? `${accountCount} connected` : "no accounts"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
