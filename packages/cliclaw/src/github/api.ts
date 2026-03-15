import { TokenStore } from "@digitalpresence/cliclaw-auth";
import { outputAuthRequired, outputError } from "../lib/output.js";

const GITHUB_API = "https://api.github.com";

export function getToken(tokenStore: TokenStore, account: string): string {
  const tokenKey = `github:${account}`;
  const creds = tokenStore.get(tokenKey);
  if (!creds?.access_token) {
    outputAuthRequired("github");
  }
  return creds.access_token as string;
}

export async function githubFetch(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    outputError("github_api_error", `${res.status} ${res.statusText}: ${body}`);
  }

  return res.json();
}

export async function githubFetchPaginated(
  token: string,
  path: string,
  maxResults: number,
): Promise<unknown[]> {
  const results: unknown[] = [];
  const separator = path.includes("?") ? "&" : "?";
  let url: string | null = `${path}${separator}per_page=${Math.min(maxResults, 100)}`;

  while (url && results.length < maxResults) {
    const fullUrl: string = url.startsWith("http") ? url : `${GITHUB_API}${url}`;
    const res: Response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      outputError("github_api_error", `${res.status} ${res.statusText}: ${body}`);
    }

    const data = await res.json();
    results.push(...(Array.isArray(data) ? data : [data]));

    // Parse Link header for next page
    const link: string | null = res.headers.get("link");
    const next: RegExpMatchArray | null | undefined = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }

  return results.slice(0, maxResults);
}
