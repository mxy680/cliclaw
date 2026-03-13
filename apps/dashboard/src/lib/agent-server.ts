const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || "http://localhost:3002";
const AGENT_API_SECRET = process.env.AGENT_API_SECRET || "";

export async function agentServerFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${AGENT_SERVER_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-secret": AGENT_API_SECRET,
      ...init?.headers,
    },
  });
}
