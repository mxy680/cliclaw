const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:3002";

export async function agentFetch(path: string, init?: RequestInit & { sessionToken?: string }): Promise<Response> {
  const { sessionToken, ...rest } = init ?? {};
  return fetch(`${AGENT_API_URL}${path}`, {
    ...rest,
    headers: {
      ...rest?.headers,
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
  });
}
