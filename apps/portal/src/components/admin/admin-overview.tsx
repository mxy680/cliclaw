import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AdminOverviewProps {
  stats: {
    totalUsers: number;
    totalAgents: number;
    totalSessions: number;
    totalCostUsd: number;
  };
}

export function AdminOverview({ stats }: AdminOverviewProps) {
  const items = [
    { label: "Users", value: stats.totalUsers },
    { label: "Agents", value: stats.totalAgents },
    { label: "Sessions", value: stats.totalSessions },
    { label: "Total Cost", value: `$${stats.totalCostUsd.toFixed(2)}` },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader>
            <CardTitle className="text-muted-foreground uppercase">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-mono font-bold">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
