import { AdminOverview } from "./admin-overview";
import { Badge } from "@/components/ui/badge";
import type { RecentGrant, RecentSession } from "./types";

interface OverviewTabProps {
  stats: {
    totalUsers: number;
    totalAgents: number;
    totalSessions: number;
  };
  recentGrants: RecentGrant[];
  recentSessions: RecentSession[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type ActivityItem =
  | { type: "grant"; data: RecentGrant; timestamp: string }
  | { type: "session"; data: RecentSession; timestamp: string };

export function OverviewTab({
  stats,
  recentGrants,
  recentSessions,
}: OverviewTabProps) {
  const items: ActivityItem[] = [
    ...recentGrants.map(
      (g) =>
        ({ type: "grant", data: g, timestamp: g.granted_at }) as ActivityItem
    ),
    ...recentSessions.map(
      (s) =>
        ({ type: "session", data: s, timestamp: s.updated_at }) as ActivityItem
    ),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="space-y-8">
      <AdminOverview stats={stats} />

      <div>
        <h2 className="font-mono text-sm font-semibold tracking-wide uppercase mb-4">
          Recent Activity
        </h2>
        <div className="space-y-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
          {items.map((item, i) => (
            <div
              key={`${item.type}-${i}`}
              className="flex items-center gap-3 py-2 px-3 rounded-sm border border-border bg-card"
            >
              <Badge variant={item.type === "grant" ? "default" : "secondary"}>
                {item.type === "grant" ? "Grant" : "Session"}
              </Badge>
              <span className="text-sm flex-1">
                {item.type === "grant" ? (
                  <>
                    <span className="font-mono text-xs">
                      {item.data.email}
                    </span>{" "}
                    granted access to{" "}
                    <span className="font-medium">{item.data.agent_name}</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-xs">
                      {item.data.email}
                    </span>{" "}
                    chatted with{" "}
                    <span className="font-medium">{item.data.agent_name}</span>
                    {item.data.title && (
                      <span className="text-muted-foreground">
                        {" "}
                        — {item.data.title}
                      </span>
                    )}
                  </>
                )}
              </span>
              <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                {timeAgo(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
