import type { TokenStore } from "@digitalpresence/cliclaw-auth";
import { getToken, vercelFetch, vercelFetchPaginated } from "./api.js";
import { outputJson, outputError } from "../lib/output.js";

// --- Account ---

export async function handleWhoami(tokenStore: TokenStore, account: string): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const user = await vercelFetch(token, "/v2/user");
    outputJson(user);
  } catch (err) {
    outputError("whoami_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Projects ---

export async function handleProjects(
  tokenStore: TokenStore,
  account: string,
  maxResults: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const projects = await vercelFetchPaginated(token, "/v9/projects", "projects", maxResults);
    outputJson(projects);
  } catch (err) {
    outputError("projects_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleProject(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const project = await vercelFetch(token, `/v9/projects/${projectId}`);
    outputJson(project);
  } catch (err) {
    outputError("project_get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleProjectCreate(
  tokenStore: TokenStore,
  account: string,
  name: string,
  framework?: string,
  gitRepo?: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const payload: Record<string, unknown> = { name };
    if (framework) payload.framework = framework;
    if (gitRepo) payload.gitRepository = { type: "github", repo: gitRepo };
    const project = await vercelFetch(token, "/v9/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    outputJson(project);
  } catch (err) {
    outputError("project_create_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleProjectDelete(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await vercelFetch(token, `/v9/projects/${projectId}`, { method: "DELETE" });
    outputJson(result);
  } catch (err) {
    outputError("project_delete_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Deployments ---

export async function handleDeployments(
  tokenStore: TokenStore,
  account: string,
  projectId?: string,
  maxResults?: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const path = projectId ? `/v6/deployments?projectId=${projectId}` : "/v6/deployments";
    const deployments = await vercelFetchPaginated(
      token,
      path,
      "deployments",
      maxResults ?? 20,
    );
    outputJson(deployments);
  } catch (err) {
    outputError("deployments_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDeployment(
  tokenStore: TokenStore,
  account: string,
  deploymentId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const deployment = await vercelFetch(token, `/v13/deployments/${deploymentId}`);
    outputJson(deployment);
  } catch (err) {
    outputError("deployment_get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleRedeploy(
  tokenStore: TokenStore,
  account: string,
  deploymentId: string,
  target?: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const payload: Record<string, unknown> = { deploymentId };
    if (target) payload.target = target;
    const result = await vercelFetch(token, "/v13/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    outputJson(result);
  } catch (err) {
    outputError("redeploy_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handlePromote(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  deploymentId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await vercelFetch(
      token,
      `/v10/projects/${projectId}/promote/${deploymentId}`,
      { method: "POST" },
    );
    outputJson(result);
  } catch (err) {
    outputError("promote_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDeploymentDelete(
  tokenStore: TokenStore,
  account: string,
  deploymentId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await vercelFetch(token, `/v13/deployments/${deploymentId}`, {
      method: "DELETE",
    });
    outputJson(result);
  } catch (err) {
    outputError("deployment_delete_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleBuildLogs(
  tokenStore: TokenStore,
  account: string,
  deploymentId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const logs = await vercelFetch(token, `/v2/deployments/${deploymentId}/events`);
    outputJson(logs);
  } catch (err) {
    outputError("build_logs_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Domains ---

export async function handleDomains(
  tokenStore: TokenStore,
  account: string,
  maxResults?: number,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const domains = await vercelFetchPaginated(
      token,
      "/v5/domains",
      "domains",
      maxResults ?? 20,
    );
    outputJson(domains);
  } catch (err) {
    outputError("domains_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDomain(
  tokenStore: TokenStore,
  account: string,
  domain: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const data = await vercelFetch(token, `/v5/domains/${domain}`);
    outputJson(data);
  } catch (err) {
    outputError("domain_get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDomainAdd(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  domain: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await vercelFetch(token, `/v9/projects/${projectId}/domains`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: domain }),
    });
    outputJson(result);
  } catch (err) {
    outputError("domain_add_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDomainRemove(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  domain: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await vercelFetch(token, `/v9/projects/${projectId}/domains/${domain}`, {
      method: "DELETE",
    });
    outputJson(result);
  } catch (err) {
    outputError("domain_remove_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDomainVerify(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  domain: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await vercelFetch(
      token,
      `/v9/projects/${projectId}/domains/${domain}/verify`,
      { method: "POST" },
    );
    outputJson(result);
  } catch (err) {
    outputError("domain_verify_failed", err instanceof Error ? err.message : String(err));
  }
}

// --- Environment Variables ---

export async function handleEnvs(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const data = await vercelFetch(token, `/v10/projects/${projectId}/env`);
    outputJson((data as Record<string, unknown>).envs);
  } catch (err) {
    outputError("envs_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleEnvGet(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  envId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const env = await vercelFetch(token, `/v10/projects/${projectId}/env/${envId}`);
    outputJson(env);
  } catch (err) {
    outputError("env_get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleEnvCreate(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  key: string,
  value: string,
  target: string[],
  type?: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const env = await vercelFetch(token, `/v10/projects/${projectId}/env`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, target, type: type || "encrypted" }),
    });
    outputJson(env);
  } catch (err) {
    outputError("env_create_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleEnvUpdate(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  envId: string,
  value: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const env = await vercelFetch(token, `/v10/projects/${projectId}/env/${envId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    outputJson(env);
  } catch (err) {
    outputError("env_update_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleEnvDelete(
  tokenStore: TokenStore,
  account: string,
  projectId: string,
  envId: string,
): Promise<void> {
  const token = getToken(tokenStore, account);
  try {
    const result = await vercelFetch(token, `/v10/projects/${projectId}/env/${envId}`, {
      method: "DELETE",
    });
    outputJson(result);
  } catch (err) {
    outputError("env_delete_failed", err instanceof Error ? err.message : String(err));
  }
}
