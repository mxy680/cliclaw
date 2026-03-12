import { getTokenStore } from "@/lib/auth";
import { IntegrationCard } from "@/components/integration-card";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const tokenStore = getTokenStore();
  const allAccounts = tokenStore.list();
  const gmailAccounts = allAccounts.filter((a) => !a.includes(":"));
  const gdriveAccounts = allAccounts.filter((a) => a.startsWith("gdrive:"));
  const calendarAccounts = allAccounts.filter((a) => a.startsWith("calendar:"));
  const formsAccounts = allAccounts.filter((a) => a.startsWith("forms:"));

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

        <IntegrationCard
          name="Google Drive"
          href="/gdrive"
          accountCount={gdriveAccounts.length}
          description="Browse, upload, download, and manage files"
        />

        <IntegrationCard
          name="Google Calendar"
          href="/calendar"
          accountCount={calendarAccounts.length}
          description="View, create, and manage calendar events"
        />

        <IntegrationCard
          name="Google Forms"
          href="/forms"
          accountCount={formsAccounts.length}
          description="Create forms, manage questions, view responses"
        />
      </div>
    </div>
  );
}
