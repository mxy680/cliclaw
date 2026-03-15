"use client";

import { useState, Fragment } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import type { UserWithStats, UserAgent, UserSession } from "./types";

interface UsersTabProps {
  users: UserWithStats[];
}

function UserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const [agents, setAgents] = useState<UserAgent[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        setAgents(data.agents || []);
        setSessions(data.sessions || []);
        setLoaded(true);
      });
    return (
      <div className="p-4 text-sm text-muted-foreground">Loading...</div>
    );
  }

  async function handleRevoke(agentName: string) {
    const res = await fetch("/api/admin/access", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, agentName }),
    });
    if (res.ok) {
      toast("Access revoked", "info");
      router.refresh();
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h4 className="font-mono text-xs font-semibold tracking-wide uppercase mb-2">
          Agents ({agents.length})
        </h4>
        {agents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No agents assigned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {agents.map((a) => (
              <div
                key={a.agent_name}
                className="flex items-center gap-2 px-2 py-1 rounded-sm border border-border bg-background text-xs"
              >
                <span className="font-mono">{a.agent_name}</span>
                <button
                  onClick={() => handleRevoke(a.agent_name)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="font-mono text-xs font-semibold tracking-wide uppercase mb-2">
          Recent Sessions ({sessions.length})
        </h4>
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No sessions</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Messages</TableHead>
                <TableHead>Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.slice(0, 10).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">
                    {s.agent_name}
                  </TableCell>
                  <TableCell className="text-xs">
                    {s.title || "Untitled"}
                  </TableCell>
                  <TableCell className="text-xs">{s.messages}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(s.updated_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

export function UsersTab({ users }: UsersTabProps) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  return (
    <div>
      <h2 className="font-mono text-sm font-semibold tracking-wide uppercase mb-4">
        Users ({users.length})
      </h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Signed Up</TableHead>
            <TableHead>Integrations</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Agents</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <Fragment key={user.id}>
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                onClick={() =>
                  setExpandedUser(
                    expandedUser === user.id ? null : user.id
                  )
                }
              >
                <TableCell className="font-mono text-xs">
                  {user.email}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-xs">
                  {user.integration_count}
                </TableCell>
                <TableCell className="text-xs">
                  {user.session_count}
                </TableCell>
                <TableCell className="text-xs">{user.agent_count}</TableCell>
              </TableRow>
              {expandedUser === user.id && (
                <TableRow key={`${user.id}-detail`}>
                  <TableCell colSpan={5} className="p-0 bg-muted/30">
                    <UserDetail userId={user.id} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground py-8"
              >
                No users yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
