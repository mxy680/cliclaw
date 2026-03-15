// DB row types (match SQLite columns exactly)
export interface UserRow {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  token: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface SessionWithUser {
  token: string;
  user_id: string;
  email: string;
  expires_at: string;
}

export interface ClientAgentAccessRow {
  id: string;
  user_id: string;
  agent_name: string;
  granted_at: string;
  granted_by: string;
}

export interface ChatSessionRow {
  id: string;
  user_id: string;
  agent_name: string;
  claude_session_id: string | null;
  title: string | null;
  messages: number;
  cost_usd: number;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

export interface ClientTokenRow {
  id: string;
  user_id: string;
  integration: string;
  account: string;
  credentials: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

// Application types
export interface AuthUser {
  id: string;
  email: string;
}

export type ChatBlock =
  | { type: "user"; content: string }
  | { type: "assistant"; content: string }
  | { type: "tool"; name: string; input?: string; done: boolean };

export interface AgentInfo {
  name: string;
  displayName: string;
  role: string;
  integrations: string[];
}

export interface IntegrationStatus {
  id: string;
  displayName: string;
  connected: boolean;
  email?: string;
  accounts: Array<{ account: string; email?: string }>;
  authType?: "oauth" | "token" | "session";
  tokenUrl?: string;
}
