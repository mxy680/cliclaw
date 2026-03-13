import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { agentFetch } from "@/lib/agent-api";
import { AdminPanel } from "@/components/admin-panel";
import { SignOutButton } from "@/components/sign-out-button";
import Link from "next/link";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

interface AgentInfo {
  name: string;
  displayName: string;
  role: string;
}

interface AccessEntry {
  id: string;
  user_id: string;
  agent_name: string;
  granted_at: string;
  granted_by: string;
}

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/chat");
  }

  // Get all access entries using service role
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: allAccess } = await service
    .from("client_agent_access")
    .select("*")
    .order("granted_at", { ascending: false });

  // Get all users
  const { data: usersData } = await service.auth.admin.listUsers();
  const users = usersData?.users ?? [];

  // Get agents
  let agents: AgentInfo[] = [];
  try {
    const res = await agentFetch("/agents");
    if (res.ok) {
      const data = await res.json();
      agents = data.agents as AgentInfo[];
    }
  } catch {}

  // Build user map
  const userMap = new Map(users.map((u) => [u.id, u.email ?? "unknown"]));

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/chat" className="font-mono text-lg font-bold tracking-tight text-amber hover:text-amber/80 transition-colors">
            cliclaw
          </Link>
          <span className="text-border">/</span>
          <span className="font-mono text-sm text-foreground">admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-muted-foreground">{user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <AdminPanel
          access={(allAccess ?? []) as AccessEntry[]}
          userMap={Object.fromEntries(userMap)}
          agents={agents}
        />
      </div>
    </div>
  );
}
