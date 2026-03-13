"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ClientData {
  userId: string;
  email: string;
  createdAt: string;
  agents: string[];
  totalSessions: number;
  totalTurns: number;
  totalCostUsd: number;
  lastActive: string | null;
}

interface AgentData {
  name: string;
  displayName: string;
  role: string;
  clientCount: number;
  totalSessions: number;
  totalTurns: number;
  totalCostUsd: number;
  integrations: string[];
}

interface AdminDashboardProps {
  clients: ClientData[];
  agents: AgentData[];
  totals: { clients: number; agents: number; sessions: number; totalCostUsd: number };
  agentOptions: { name: string; displayName: string }[];
  grantAction: (email: string, agentName: string) => Promise<void>;
  revokeAction: (userId: string, agentName: string) => Promise<void>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCost(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <p className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase mb-1">{label}</p>
      <p className="text-2xl font-light text-foreground">{value}</p>
    </div>
  );
}

export function AdminDashboard({ clients, agents, totals, agentOptions, grantAction, revokeAction }: AdminDashboardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"clients" | "agents">("clients");
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Grant form state
  const [grantEmail, setGrantEmail] = useState("");
  const [grantAgent, setGrantAgent] = useState(agentOptions[0]?.name ?? "");
  const [granting, setGranting] = useState(false);

  // Inline add-client state (per agent)
  const [addClientEmail, setAddClientEmail] = useState<Record<string, string>>({});
  const [addingClient, setAddingClient] = useState<string | null>(null);

  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleGrant() {
    if (!grantEmail.trim() || !grantAgent) return;
    setGranting(true);
    await grantAction(grantEmail.trim(), grantAgent);
    setGrantEmail("");
    setGranting(false);
    router.refresh();
  }

  async function handleRevoke(userId: string, agentName: string) {
    const key = `${userId}:${agentName}`;
    setRevoking(key);
    await revokeAction(userId, agentName);
    setRevoking(null);
    router.refresh();
  }

  async function handleAddClient(agentName: string) {
    const email = addClientEmail[agentName]?.trim();
    if (!email) return;
    setAddingClient(agentName);
    await grantAction(email, agentName);
    setAddClientEmail((prev) => ({ ...prev, [agentName]: "" }));
    setAddingClient(null);
    router.refresh();
  }

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Clients" value={totals.clients} />
        <StatCard label="Active Agents" value={totals.agents} />
        <StatCard label="Total Sessions" value={totals.sessions} />
        <StatCard label="Total Cost" value={formatCost(totals.totalCostUsd)} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border">
        <button
          onClick={() => setTab("clients")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "clients"
              ? "border-amber text-amber"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => setTab("agents")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "agents"
              ? "border-amber text-amber"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Agents
        </button>
      </div>

      {/* Clients tab */}
      {tab === "clients" && (
        <div>
          {/* Grant access form */}
          <div className="flex gap-3 items-end mb-6">
            <div className="flex-1">
              <label className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase mb-1 block">
                Email
              </label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={grantEmail}
                onChange={(e) => setGrantEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGrant()}
              />
            </div>
            <div className="w-48">
              <label className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase mb-1 block">
                Agent
              </label>
              <select
                value={grantAgent}
                onChange={(e) => setGrantAgent(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {agentOptions.map((a) => (
                  <option key={a.name} value={a.name}>{a.displayName}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleGrant} disabled={granting || !grantEmail.trim()}>
              {granting ? "Granting..." : "Grant Access"}
            </Button>
          </div>

          {/* Client list */}
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet. Grant access above to get started.</p>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div key={client.userId} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedClient(expandedClient === client.userId ? null : client.userId)}
                    className="w-full flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/30 transition-colors text-left"
                  >
                    <span className="font-medium text-foreground flex-1">{client.email}</span>
                    <span className="text-muted-foreground text-xs">{formatDate(client.createdAt)}</span>
                    <Badge variant="secondary">{client.agents.length} agent{client.agents.length !== 1 ? "s" : ""}</Badge>
                    <span className="font-mono text-xs text-muted-foreground w-20 text-right">{client.totalSessions} sess</span>
                    <span className="font-mono text-xs text-muted-foreground w-16 text-right">{formatCost(client.totalCostUsd)}</span>
                    <span className="text-muted-foreground text-xs w-20 text-right">{client.lastActive ? formatDate(client.lastActive) : "never"}</span>
                    <span className="text-muted-foreground">{expandedClient === client.userId ? "▾" : "▸"}</span>
                  </button>
                  {expandedClient === client.userId && (
                    <div className="border-t border-border bg-muted/10 px-4 py-3">
                      {client.agents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No agents assigned.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
                              <th className="text-left py-1">Agent</th>
                              <th className="text-right py-1">Sessions</th>
                              <th className="text-right py-1">Cost</th>
                              <th className="text-right py-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {client.agents.map((agentName) => {
                              const agent = agents.find((a) => a.name === agentName);
                              const key = `${client.userId}:${agentName}`;
                              return (
                                <tr key={agentName} className="border-t border-border/50">
                                  <td className="py-2">{agent?.displayName ?? agentName}</td>
                                  <td className="text-right font-mono text-xs text-muted-foreground">—</td>
                                  <td className="text-right font-mono text-xs text-muted-foreground">—</td>
                                  <td className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRevoke(client.userId, agentName)}
                                      disabled={revoking === key}
                                      className="text-destructive hover:text-destructive h-7 text-xs"
                                    >
                                      {revoking === key ? "..." : "Revoke"}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agents tab */}
      {tab === "agents" && (
        <div className="space-y-2">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents configured yet.</p>
          ) : (
            agents.map((agent) => (
              <div key={agent.name} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedAgent(expandedAgent === agent.name ? null : agent.name)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/30 transition-colors text-left"
                >
                  <span className="font-medium text-foreground flex-1">{agent.displayName}</span>
                  <div className="flex gap-1">
                    {agent.integrations.map((i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-mono">{i}</Badge>
                    ))}
                  </div>
                  <Badge variant="secondary">{agent.clientCount} client{agent.clientCount !== 1 ? "s" : ""}</Badge>
                  <span className="font-mono text-xs text-muted-foreground w-20 text-right">{agent.totalSessions} sess</span>
                  <span className="font-mono text-xs text-muted-foreground w-16 text-right">{formatCost(agent.totalCostUsd)}</span>
                  <span className="text-muted-foreground">{expandedAgent === agent.name ? "▾" : "▸"}</span>
                </button>
                {expandedAgent === agent.name && (
                  <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-4">
                    <p className="text-sm text-muted-foreground">{agent.role}</p>

                    {/* Clients with access */}
                    {(() => {
                      const agentClients = clients.filter((c) => c.agents.includes(agent.name));
                      return agentClients.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No clients have access.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-muted-foreground font-mono text-[10px] tracking-wider uppercase">
                              <th className="text-left py-1">Client</th>
                              <th className="text-right py-1">Joined</th>
                              <th className="text-right py-1">Last Active</th>
                              <th className="text-right py-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {agentClients.map((client) => {
                              const key = `${client.userId}:${agent.name}`;
                              return (
                                <tr key={client.userId} className="border-t border-border/50">
                                  <td className="py-2">{client.email}</td>
                                  <td className="text-right text-xs text-muted-foreground">{formatDate(client.createdAt)}</td>
                                  <td className="text-right text-xs text-muted-foreground">{client.lastActive ? formatDate(client.lastActive) : "never"}</td>
                                  <td className="text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleRevoke(client.userId, agent.name)}
                                      disabled={revoking === key}
                                      className="text-destructive hover:text-destructive h-7 text-xs"
                                    >
                                      {revoking === key ? "..." : "Revoke"}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}

                    {/* Inline add client */}
                    <div className="flex gap-2 items-center">
                      <Input
                        type="email"
                        placeholder="Add client email..."
                        className="h-8 text-xs flex-1"
                        value={addClientEmail[agent.name] ?? ""}
                        onChange={(e) => setAddClientEmail((prev) => ({ ...prev, [agent.name]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleAddClient(agent.name)}
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleAddClient(agent.name)}
                        disabled={addingClient === agent.name || !addClientEmail[agent.name]?.trim()}
                      >
                        {addingClient === agent.name ? "..." : "Add"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
