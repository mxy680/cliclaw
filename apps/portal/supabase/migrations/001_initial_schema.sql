-- Portal schema: client agent access + chat sessions

-- client_agent_access: which users can access which agents
create table if not exists client_agent_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_name text not null,
  granted_at timestamptz default now(),
  granted_by text not null,
  unique(user_id, agent_name)
);

-- chat_sessions: portal chat history
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  agent_name text not null,
  claude_session_id text,
  title text not null default 'New Chat',
  messages jsonb not null default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  cost_usd numeric default 0,
  turn_count integer default 0
);

-- Enable RLS
alter table client_agent_access enable row level security;
alter table chat_sessions enable row level security;

-- Users can only read their own access
create policy "users read own access" on client_agent_access
  for select using (auth.uid() = user_id);

-- Users can only CRUD their own chat sessions
create policy "users manage own chats" on chat_sessions
  for all using (auth.uid() = user_id);
