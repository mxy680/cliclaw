const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:3002";
const AGENT_API_SECRET = process.env.AGENT_API_SECRET || "";

export async function agentFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${AGENT_API_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      "x-api-secret": AGENT_API_SECRET,
    },
  });
}
