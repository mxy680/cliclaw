import { getTokenStore } from "@/lib/auth";
import { IntegrationCard } from "@/components/integration-card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const tokenStore = getTokenStore();
  const gmailAccounts = tokenStore.list();

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-light tracking-wide text-foreground">
            Integrations
          </h1>
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider mt-1">
            / OVERVIEW
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage connected services and accounts.
        </p>
      </div>

      <Separator className="bg-border mb-8" />

      {/* Integration grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <IntegrationCard
          name="Gmail"
          href="/gmail"
          accountCount={gmailAccounts.length}
          description="Read, send, and manage email"
        />

        {/* Placeholder for future integrations */}
        <div className="border border-dashed border-border rounded-sm flex items-center justify-center py-8 opacity-40">
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
            More integrations soon
          </span>
        </div>
      </div>
    </div>
  );
}
