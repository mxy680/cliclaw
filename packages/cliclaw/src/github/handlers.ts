import type { TokenStore } from "@digitalpresence/cliclaw-auth";
import { getToken, githubFetch, githubFetchPaginated } from "./api.js";
import { outputJson, outputError } from "../lib/output.js";

// --- User ---

export async function handleWhoami(tokenStore: TokenStore, account: string): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const user = await githubFetch(token, "/user");
    outputJson(user);
  } catch (err) {
    outputError("whoami_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Repos ---

export async function handleRepos(
  tokenStore: TokenStore,
  account: string,
  maxResults: number,
  type: string,
  sort: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const repos = await githubFetchPaginated(
      token,
      `/user/repos?type=${type}&sort=${sort}`,
      maxResults,
    );
    outputJson(repos);
  } catch (err) {
    outputError("repos_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleRepoGet(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const data = await githubFetch(token, `/repos/${owner}/${repo}`);
    outputJson(data);
  } catch (err) {
    outputError("repo_get_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Issues ---

export async function handleIssues(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  state: string,
  maxResults: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const issues = await githubFetchPaginated(
      token,
      `/repos/${owner}/${repo}/issues?state=${state}`,
      maxResults,
    );
    outputJson(issues);
  } catch (err) {
    outputError("issues_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleIssueGet(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  number: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const issue = await githubFetch(token, `/repos/${owner}/${repo}/issues/${number}`);
    outputJson(issue);
  } catch (err) {
    outputError("issue_get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleIssueCreate(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const payload: Record<string, unknown> = { title };
    if (body) payload.body = body;
    if (labels?.length) payload.labels = labels;
    const issue = await githubFetch(token, `/repos/${owner}/${repo}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    outputJson(issue);
  } catch (err) {
    outputError("issue_create_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleIssueComment(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  number: number,
  body: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const comment = await githubFetch(
      token,
      `/repos/${owner}/${repo}/issues/${number}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      },
    );
    outputJson(comment);
  } catch (err) {
    outputError("issue_comment_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleIssueClose(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  number: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const issue = await githubFetch(token, `/repos/${owner}/${repo}/issues/${number}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: "closed" }),
    });
    outputJson(issue);
  } catch (err) {
    outputError("issue_close_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Pull Requests ---

export async function handlePulls(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  state: string,
  maxResults: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const prs = await githubFetchPaginated(
      token,
      `/repos/${owner}/${repo}/pulls?state=${state}`,
      maxResults,
    );
    outputJson(prs);
  } catch (err) {
    outputError("pulls_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handlePullGet(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  number: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const pr = await githubFetch(token, `/repos/${owner}/${repo}/pulls/${number}`);
    outputJson(pr);
  } catch (err) {
    outputError("pull_get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handlePullReviews(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  number: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const reviews = await githubFetch(
      token,
      `/repos/${owner}/${repo}/pulls/${number}/reviews`,
    );
    outputJson(reviews);
  } catch (err) {
    outputError("pull_reviews_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handlePullMerge(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  number: number,
  method: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await githubFetch(
      token,
      `/repos/${owner}/${repo}/pulls/${number}/merge`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merge_method: method }),
      },
    );
    outputJson(result);
  } catch (err) {
    outputError("pull_merge_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Notifications ---

export async function handleNotifications(
  tokenStore: TokenStore,
  account: string,
  maxResults: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const notifications = await githubFetchPaginated(
      token,
      "/notifications",
      maxResults,
    );
    outputJson(notifications);
  } catch (err) {
    outputError("notifications_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Search ---

export async function handleSearch(
  tokenStore: TokenStore,
  account: string,
  query: string,
  type: string,
  maxResults: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const data = await githubFetch(
      token,
      `/search/${type}?q=${encodeURIComponent(query)}&per_page=${Math.min(maxResults, 100)}`,
    );
    outputJson(data);
  } catch (err) {
    outputError("search_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Actions ---

export async function handleWorkflowRuns(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  maxResults: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const data = await githubFetch(
      token,
      `/repos/${owner}/${repo}/actions/runs?per_page=${Math.min(maxResults, 100)}`,
    );
    outputJson(data);
  } catch (err) {
    outputError("workflow_runs_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleWorkflowRunLogs(
  tokenStore: TokenStore,
  account: string,
  owner: string,
  repo: string,
  runId: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const jobs = await githubFetch(
      token,
      `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
    );
    outputJson(jobs);
  } catch (err) {
    outputError("workflow_logs_failed", err instanceof Error ? err.message : String(err));
  }
}
