import { Router, type Request, type Response } from "express";
import { AgentStore, getAgentsDir, INTEGRATIONS } from "@cliclaw/auth";
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
  type AgentConfigFull = { name: string; displayName: string; role: string; permissions: { integration: string }[] };
  for (const agent of allAgents) {
    const a = agent as AgentConfigFull;
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

  // Attach integrations to each agent
  const agentConfigMap = new Map(allAgents.map((a: AgentConfigFull) => [a.name, a]));
  const agentsWithIntegrations = agents.map((a) => {
    const config = agentConfigMap.get(a.name);
    const integrations = config
      ? [...new Set(config.permissions.map((p: { integration: string }) => p.integration))]
      : [];
    return { ...a, integrations };
  });

  const totals = {
    clients: clients.length,
    agents: agents.length,
    sessions: clients.reduce((sum, c) => sum + c.totalSessions, 0),
    totalCostUsd: clients.reduce((sum, c) => sum + c.totalCostUsd, 0),
  };

  res.json({ clients, agents: agentsWithIntegrations, totals });
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

// GET /admin/agents/:name — get full agent config
router.get("/agents/:name", (req: Request, res: Response) => {
  const store = new AgentStore(getAgentsDir());
  const agent = store.get(req.params.name as string);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  const integrations = [...new Set(agent.permissions.map((p) => p.integration))];
  res.json({ ...agent, integrations });
});

// POST /admin/agents — create agent
router.post("/agents", (req: Request, res: Response) => {
  const { name, displayName, role, integrations } = req.body as {
    name?: string;
    displayName?: string;
    role?: string;
    integrations?: string[];
  };

  if (!name || !displayName || !role) {
    res.status(400).json({ error: "name, displayName, and role are required" });
    return;
  }

  const store = new AgentStore(getAgentsDir());
  if (store.get(name)) {
    res.status(409).json({ error: `Agent "${name}" already exists` });
    return;
  }

  // Validate integrations
  const validIntegrations = (integrations ?? []).filter((i) => i in INTEGRATIONS);

  const now = new Date().toISOString();
  store.scaffoldWorkspace({
    name,
    displayName,
    role,
    permissions: validIntegrations.map((i) => ({ integration: i, account: "client" })),
    memory: [],
    cronJobs: [],
    createdAt: now,
    updatedAt: now,
  });

  res.json({ ok: true, name });
});

// PUT /admin/agents/:name — update agent
router.put("/agents/:name", (req: Request, res: Response) => {
  const agentName = req.params.name as string;
  const { displayName, role, integrations } = req.body as {
    displayName?: string;
    role?: string;
    integrations?: string[];
  };

  const store = new AgentStore(getAgentsDir());
  const agent = store.get(agentName);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  if (displayName !== undefined) agent.displayName = displayName;
  if (role !== undefined) agent.role = role;
  if (integrations !== undefined) {
    const validIntegrations = integrations.filter((i) => i in INTEGRATIONS);
    agent.permissions = validIntegrations.map((i) => ({ integration: i, account: "client" }));
  }

  agent.updatedAt = new Date().toISOString();
  store.save(agent);
  store.regenerateClaudeMd(agentName);

  res.json({ ok: true, name: agentName });
});

// DELETE /admin/agents/:name — delete agent + revoke all access
router.delete("/agents/:name", (req: Request, res: Response) => {
  const agentName = req.params.name as string;
  const store = new AgentStore(getAgentsDir());

  if (!store.delete(agentName)) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  // Revoke all client access for this agent
  const allAccess = stmts.listAllAccess.all() as { user_id: string; agent_name: string }[];
  for (const a of allAccess) {
    if (a.agent_name === agentName) {
      stmts.revokeAccess.run(a.user_id, agentName);
    }
  }

  res.json({ ok: true, name: agentName });
});

export default router;
