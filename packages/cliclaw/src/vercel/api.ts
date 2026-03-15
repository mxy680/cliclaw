import { TokenStore } from "@digitalpresence/cliclaw-auth";
import { outputAuthRequired, outputError } from "../lib/output.js";

const VERCEL_API = "https://api.vercel.com";

export function getToken(tokenStore: TokenStore, account: string): string {
  const tokenKey = `vercel:${account}`;
  const creds = tokenStore.get(tokenKey);
  if (!creds?.access_token) {
    outputAuthRequired("vercel");
  }
  return creds.access_token as string;
}

export async function vercelFetch(
  token: string,
  path: string,
  options: RequestInit = {},
  teamId?: string,
): Promise<unknown> {
  let url = path.startsWith("http") ? path : `${VERCEL_API}${path}`;
  if (teamId) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}teamId=${teamId}`;
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    outputError("vercel_api_error", `${res.status} ${res.statusText}: ${body}`);
  }

  return res.json();
}

export async function vercelFetchPaginated(
  token: string,
  path: string,
  arrayKey: string,
  maxResults: number,
  teamId?: string,
): Promise<unknown[]> {
  const results: unknown[] = [];
  const separator = path.includes("?") ? "&" : "?";
  let url: string | null = `${path}${separator}limit=${Math.min(maxResults, 100)}`;

  while (url && results.length < maxResults) {
    let fullUrl = url.startsWith("http") ? url : `${VERCEL_API}${url}`;
    if (teamId) {
      const sep = fullUrl.includes("?") ? "&" : "?";
      fullUrl = `${fullUrl}${sep}teamId=${teamId}`;
    }
    const res: Response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      outputError("vercel_api_error", `${res.status} ${res.statusText}: ${body}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    const items = data[arrayKey];
    results.push(...(Array.isArray(items) ? items : []));

    const pagination = data.pagination as { next?: number } | undefined;
    if (pagination?.next) {
      const basePath: string = url!.split("?")[0];
      const existingParams: string = url!.includes("?") ? url!.split("?")[1] : "";
      const params: URLSearchParams = new URLSearchParams(existingParams);
      params.set("until", String(pagination.next));
      url = `${basePath}?${params.toString()}`;
    } else {
      url = null;
    }
  }

  return results.slice(0, maxResults);
}
