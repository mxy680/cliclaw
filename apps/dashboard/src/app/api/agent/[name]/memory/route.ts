import { AgentStore, getAgentsDir } from "@cliclaw/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const store = new AgentStore(getAgentsDir());
  const agent = store.get(name);
  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const memoryStore = store.getMemoryStore(name);
  const url = new URL(_request.url);
  const query = url.searchParams.get("q");

  const entries = query ? memoryStore.search(query) : memoryStore.list();
  return Response.json({ entries });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const store = new AgentStore(getAgentsDir());
  const agent = store.get(name);
  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    fact: string;
    tags?: string[];
    source?: "user" | "agent" | "system";
    importance?: 1 | 2 | 3;
  };

  if (!body.fact?.trim()) {
    return Response.json({ error: "fact is required" }, { status: 400 });
  }

  const memoryStore = store.getMemoryStore(name);
  const entry = memoryStore.add(body.fact.trim(), {
    tags: body.tags,
    source: body.source ?? "user",
    importance: body.importance ?? 2,
  });
  store.regenerateClaudeMd(name);

  return Response.json({ entry }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const store = new AgentStore(getAgentsDir());
  const agent = store.get(name);
  if (!agent) {
    return Response.json({ error: "Agent not found" }, { status: 404 });
  }

  const body = (await request.json()) as { id: string };
  if (!body.id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const memoryStore = store.getMemoryStore(name);
  const removed = memoryStore.remove(body.id);
  if (!removed) {
    return Response.json({ error: "Memory not found" }, { status: 404 });
  }
  store.regenerateClaudeMd(name);

  return Response.json({ ok: true });
}
