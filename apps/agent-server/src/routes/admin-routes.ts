import { Router, type Request, type Response } from "express";
import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { stmts, generateId } from "../db.js";
import { requireAdminOrSecret } from "../auth.js";

const router = Router();

// All admin routes require admin session or API secret
router.use(requireAdminOrSecret);

// GET /admin/users — list all users
router.get("/users", (_req: Request, res: Response) => {
  const users = stmts.listUsers.all();
  res.json({ users });
});

// GET /admin/access — list all access entries
router.get("/access", (_req: Request, res: Response) => {
  const access = stmts.listAllAccess.all();
  res.json({ access });
});

// GET /admin/stats — aggregated client + agent stats
router.get("/stats", (_req: Request, res: Response) => {
  const store = new AgentStore(getAgentsDir());
  const allAgents = store.list();

  // Per-user stats
  const userStats = stmts.userStats.all() as {
    id: string;
    email: string;
    created_at: string;
    total_sessions: number;
    total_turns: number;
    total_cost_usd: number;
    last_active: string | null;
  }[];

  // Per-user agent access
  const allAccess = stmts.listAllAccess.all() as {
    user_id: string;
    agent_name: string;
    user_email: string;
  }[];
  const accessByUser = new Map<string, string[]>();
  for (const a of allAccess) {
    const list = accessByUser.get(a.user_id) ?? [];
    list.push(a.agent_name);
    accessByUser.set(a.user_id, list);
  }

  const clients = userStats.map((u) => ({
    userId: u.id,
    email: u.email,
    createdAt: u.created_at,
    agents: accessByUser.get(u.id) ?? [],
    totalSessions: u.total_sessions,
    totalTurns: u.total_turns,
    totalCostUsd: u.total_cost_usd,
    lastActive: u.last_active,
  }));

  // Per-agent stats
  const agentStats = stmts.agentStats.all() as {
    agent_name: string;
    client_count: number;
    total_sessions: number;
    total_turns: number;
    total_cost_usd: number;
  }[];

  type AgentInfo = { name: string; displayName: string; role: string };
  const agentMap = new Map(allAgents.map((a: AgentInfo) => [a.name, a]));
  const agents = agentStats.map((a) => {
    const info = agentMap.get(a.agent_name);
    return {
      name: a.agent_name,
      displayName: info?.displayName ?? a.agent_name,
      role: info?.role ?? "",
      clientCount: a.client_count,
      totalSessions: a.total_sessions,
      totalTurns: a.total_turns,
      totalCostUsd: a.total_cost_usd,
    };
  });

  // Include agents with no usage yet
  for (const agent of allAgents) {
    const a = agent as AgentInfo;
    if (!agentStats.find((s) => s.agent_name === a.name)) {
      agents.push({
        name: a.name,
        displayName: a.displayName,
        role: a.role,
        clientCount: 0,
        totalSessions: 0,
        totalTurns: 0,
        totalCostUsd: 0,
      });
    }
  }

  const totals = {
    clients: clients.length,
    agents: agents.length,
    sessions: clients.reduce((sum, c) => sum + c.totalSessions, 0),
    totalCostUsd: clients.reduce((sum, c) => sum + c.totalCostUsd, 0),
  };

  res.json({ clients, agents, totals });
});

// POST /admin/access — grant access
router.post("/access", (req: Request, res: Response) => {
  const { email, agentName } = req.body as { email?: string; agentName?: string };

  if (!email || !agentName) {
    res.status(400).json({ error: "email and agentName required" });
    return;
  }

  // Find or create user
  let user = stmts.findUserByEmail.get(email.toLowerCase().trim()) as { id: string } | undefined;
  if (!user) {
    const id = generateId();
    user = stmts.createUser.get(id, email.toLowerCase().trim()) as { id: string };
  }

  const id = generateId();
  const grantedBy = req.user?.email ?? "dashboard";
  stmts.grantAccess.run(id, user.id, agentName, grantedBy);

  res.json({ ok: true });
});

// DELETE /admin/access — revoke access
router.delete("/access", (req: Request, res: Response) => {
  const { userId, agentName } = req.body as { userId?: string; agentName?: string };

  if (!userId || !agentName) {
    res.status(400).json({ error: "userId and agentName required" });
    return;
  }

  stmts.revokeAccess.run(userId, agentName);
  res.json({ ok: true });
});

export default router;
