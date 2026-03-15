export interface UserWithStats {
  id: string;
  email: string;
  created_at: string;
  integration_count: number;
  session_count: number;
  total_cost: number;
  agent_count: number;
}

export interface SessionWithEmail {
  id: string;
  user_id: string;
  email: string;
  agent_name: string;
  title: string | null;
  messages: number;
  cost_usd: number;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

export interface RecentGrant {
  id: string;
  user_id: string;
  email: string;
  agent_name: string;
  granted_at: string;
  granted_by: string;
}

export interface RecentSession {
  id: string;
  user_id: string;
  email: string;
  agent_name: string;
  title: string | null;
  messages: number;
  cost_usd: number;
  created_at: string;
  updated_at: string;
}

export interface AgentWithStats {
  name: string;
  displayName: string;
  role: string;
  integrations: string[];
  cronJobs: number;
  userCount: number;
  sessionCount: number;
  totalCost: number;
  users: Array<{ user_id: string; email: string; granted_at: string }>;
}

export interface UserAgent {
  agent_name: string;
  granted_at: string;
}

export interface UserSession {
  id: string;
  agent_name: string;
  title: string | null;
  messages: number;
  cost_usd: number;
  created_at: string;
  updated_at: string;
}
