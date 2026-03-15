"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { SessionWithEmail, AgentWithStats, UserWithStats } from "./types";

interface SessionsTabProps {
  sessions: SessionWithEmail[];
  agents: AgentWithStats[];
  users: UserWithStats[];
}

export function SessionsTab({ sessions, agents, users }: SessionsTabProps) {
  const [agentFilter, setAgentFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (agentFilter && s.agent_name !== agentFilter) return false;
      if (userFilter && s.user_id !== userFilter) return false;
      return true;
    });
  }, [sessions, agentFilter, userFilter]);

  return (
    <div>
      <h2 className="font-mono text-sm font-semibold tracking-wide uppercase mb-4">
        Sessions ({filtered.length})
      </h2>

      <div className="flex gap-3 mb-4">
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground focus:border-amber/50 focus:ring-1 focus:ring-amber/20 focus:outline-none"
        >
          <option value="">All Agents</option>
          {agents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.displayName}
            </option>
          ))}
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="h-9 rounded-sm border border-border bg-background px-3 text-sm text-foreground focus:border-amber/50 focus:ring-1 focus:ring-amber/20 focus:outline-none"
        >
          <option value="">All Users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email}
            </option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Agent</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Messages</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Last Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-mono text-xs">{s.email}</TableCell>
              <TableCell className="text-xs">{s.agent_name}</TableCell>
              <TableCell className="text-xs">
                {s.title || "Untitled"}
              </TableCell>
              <TableCell className="text-xs">{s.messages}</TableCell>
              <TableCell className="font-mono text-xs">
                ${s.cost_usd.toFixed(2)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(s.updated_at).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={7}
                className="text-center text-muted-foreground py-8"
              >
                No sessions found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
