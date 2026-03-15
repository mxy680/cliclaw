"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { AgentWithStats } from "./types";

interface AgentsTabProps {
  agents: AgentWithStats[];
}

function AgentCard({ agent }: { agent: AgentWithStats }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGrant(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), agentName: agent.name }),
      });
      if (res.ok) {
        setEmail("");
        toast("Access granted", "success");
        router.refresh();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to grant access", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(userId: string) {
    const res = await fetch("/api/admin/access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, agentName: agent.name }),
    });
    if (res.ok) {
      toast("Access revoked", "info");
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{agent.displayName}</CardTitle>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              {agent.name}
            </p>
          </div>
          <div className="flex gap-2">
            {agent.integrations.map((intg) => (
              <Badge key={intg} variant="outline">
                {intg}
              </Badge>
            ))}
            {agent.cronJobs > 0 && (
              <Badge variant="secondary">
                {agent.cronJobs} cron
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{agent.role}</p>

        <div className="flex gap-6 text-xs">
          <div>
            <span className="text-muted-foreground">Users:</span>{" "}
            <span className="font-mono font-medium">{agent.userCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Sessions:</span>{" "}
            <span className="font-mono font-medium">{agent.sessionCount}</span>
          </div>
        </div>

        <form onSubmit={handleGrant} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1"
          />
          <Button type="submit" disabled={loading} size="sm">
            Grant
          </Button>
        </form>

        {agent.users.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-mono tracking-wide uppercase text-muted-foreground">
              Users with access
            </p>
            {agent.users.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between py-1 px-2 rounded-sm border border-border bg-background text-xs"
              >
                <span className="font-mono">{u.email}</span>
                <button
                  onClick={() => handleRevoke(u.user_id)}
                  className="text-muted-foreground hover:text-destructive transition-colors text-xs"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AgentsTab({ agents }: AgentsTabProps) {
  return (
    <div>
      <h2 className="font-mono text-sm font-semibold tracking-wide uppercase mb-4">
        Agents ({agents.length})
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {agents.map((agent) => (
          <AgentCard key={agent.name} agent={agent} />
        ))}
        {agents.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-2">
            No agents configured
          </p>
        )}
      </div>
    </div>
  );
}
