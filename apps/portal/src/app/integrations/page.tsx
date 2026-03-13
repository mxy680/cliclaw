import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { agentFetch } from "@/lib/agent-api";
import { IntegrationsPage } from "@/components/integrations-page";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

export default async function Integrations({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) redirect("/");

  const sessionRes = await agentFetch("/auth/session", { sessionToken: session });
  if (!sessionRes.ok) redirect("/");
  const { user } = (await sessionRes.json()) as { user: { email: string } };

  const { connected } = await searchParams;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/chat"
            className="font-mono text-lg font-bold tracking-tight text-amber hover:text-amber/80 transition-colors"
          >
            cliclaw
          </Link>
          <span className="text-border">/</span>
          <span className="font-mono text-sm text-foreground">Integrations</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-2xl px-6 py-10">
        <IntegrationsPage initialConnected={connected} />
      </div>
    </div>
  );
}
