import { getTokenStore } from "@/lib/auth";
import { IntegrationCard } from "@/components/integration-card";

export const dynamic = "force-dynamic";

export default function OverviewPage() {
  const tokenStore = getTokenStore();
  const gmailAccounts = tokenStore.list();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Integrations</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <IntegrationCard
          name="Gmail"
          href="/gmail"
          accountCount={gmailAccounts.length}
          description="Read, send, and manage email"
        />
      </div>
    </div>
  );
}
