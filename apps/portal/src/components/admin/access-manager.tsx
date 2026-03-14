"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

interface AccessGrant {
  id: string;
  user_id: string;
  email: string;
  agent_name: string;
  granted_at: string;
}

interface AccessManagerProps {
  initialAccess: AccessGrant[];
  agents: Array<{ name: string; displayName: string }>;
}

export function AccessManager({ initialAccess, agents }: AccessManagerProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [agentName, setAgentName] = useState(agents[0]?.name || "");
  const [loading, setLoading] = useState(false);

  async function handleGrant(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !agentName) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), agentName }),
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

  async function handleRevoke(userId: string, agent: string) {
    const res = await fetch("/api/admin/access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, agentName: agent }),
    });
    if (res.ok) {
      toast("Access revoked", "info");
      router.refresh();
    }
  }

  return (
    <div>
      <h2 className="font-mono text-sm font-semibold tracking-wide uppercase mb-4">
        Access Management
      </h2>

      <form onSubmit={handleGrant} className="flex items-end gap-3 mb-6">
        <div className="flex-1">
          <label className="block text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1 font-mono uppercase tracking-wider">
            Agent
          </label>
          <select
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            className="h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground focus:border-amber/50 focus:ring-1 focus:ring-amber/20 focus:outline-none"
          >
            {agents.map((a) => (
              <option key={a.name} value={a.name}>
                {a.displayName}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={loading} size="sm">
          Grant
        </Button>
      </form>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Granted</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {initialAccess.map((grant) => (
            <TableRow key={grant.id}>
              <TableCell className="font-mono text-xs">
                {grant.email}
              </TableCell>
              <TableCell>{grant.agent_name}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(grant.granted_at).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    handleRevoke(grant.user_id, grant.agent_name)
                  }
                  className="text-muted-foreground hover:text-destructive"
                >
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {initialAccess.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-muted-foreground py-8"
              >
                No access grants yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
