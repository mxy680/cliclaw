"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AccessEntry {
  id: string;
  user_id: string;
  agent_name: string;
  granted_at: string;
  granted_by: string;
}

interface AgentInfo {
  name: string;
  displayName: string;
}

interface AdminPanelProps {
  access: AccessEntry[];
  userMap: Record<string, string>;
  agents: AgentInfo[];
}

export function AdminPanel({ access, userMap, agents }: AdminPanelProps) {
  const [email, setEmail] = useState("");
  const [agentName, setAgentName] = useState(agents[0]?.name ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !agentName) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), agentName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to grant access");
      }

      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(userId: string, agentName: string) {
    if (!confirm("Revoke access?")) return;

    try {
      const res = await fetch("/api/admin/access", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, agentName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke access");
      }

      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="space-y-8">
      {/* Grant access form */}
      <div>
        <h2 className="font-mono text-sm text-muted-foreground tracking-wider uppercase mb-4">
          Grant Access
        </h2>
        <form onSubmit={handleGrant} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            required
            disabled={loading}
            className="flex-1 rounded-sm border border-border bg-card px-4 py-2.5 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-amber/50 focus:outline-none focus:ring-1 focus:ring-amber/20 disabled:opacity-50"
          />
          <select
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            disabled={loading}
            className="rounded-sm border border-border bg-card px-3 py-2.5 font-mono text-sm text-foreground focus:border-amber/50 focus:outline-none disabled:opacity-50"
          >
            {agents.map((a) => (
              <option key={a.name} value={a.name}>{a.displayName}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !email.trim() || !agentName}
            className="px-5 py-2.5 bg-amber/10 border border-amber/30 rounded-sm font-mono text-xs text-amber tracking-wider uppercase hover:bg-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Grant
          </button>
        </form>
        {error && (
          <p className="mt-2 font-mono text-xs text-destructive">{error}</p>
        )}
      </div>

      {/* Access table */}
      <div>
        <h2 className="font-mono text-sm text-muted-foreground tracking-wider uppercase mb-4">
          Current Access
        </h2>
        {access.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground">No access grants yet.</p>
        ) : (
          <div className="border border-border rounded-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-card">
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] text-muted-foreground tracking-wider uppercase">User</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] text-muted-foreground tracking-wider uppercase">Agent</th>
                  <th className="px-4 py-2.5 text-left font-mono text-[10px] text-muted-foreground tracking-wider uppercase">Granted</th>
                  <th className="px-4 py-2.5 text-right font-mono text-[10px] text-muted-foreground tracking-wider uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {access.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-sm text-foreground">
                      {userMap[entry.user_id] ?? entry.user_id}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-amber/80">
                      {entry.agent_name}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {new Date(entry.granted_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleRevoke(entry.user_id, entry.agent_name)}
                        className="font-mono text-xs text-destructive hover:text-destructive/80 transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
