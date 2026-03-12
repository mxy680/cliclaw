import { google } from "googleapis";
import { OAuthClientManager } from "./oauth-client-manager.js";
import { TokenStore } from "./token-store.js";
import type { AgentPermission } from "./agent-store.js";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export class PermissionDeniedError extends Error {
  constructor(integration: string, account: string) {
    super(`Agent does not have permission for ${integration}:${account}`);
    this.name = "PermissionDeniedError";
  }
}

function parseAccountKey(key: string): { integration: string; account: string } {
  const colonIdx = key.indexOf(":");
  if (colonIdx === -1) {
    return { integration: "gmail", account: key };
  }
  return { integration: key.slice(0, colonIdx), account: key.slice(colonIdx + 1) };
}

export class ScopedClientManager {
  constructor(
    private inner: OAuthClientManager,
    private permissions: AgentPermission[],
  ) {}

  private hasPermission(integration: string, account: string): boolean {
    return this.permissions.some(
      (p) => p.integration === integration && p.account === account,
    );
  }

  getClient(accountKey: string): OAuth2Client {
    const { integration, account } = parseAccountKey(accountKey);
    if (!this.hasPermission(integration, account)) {
      throw new PermissionDeniedError(integration, account);
    }
    return this.inner.getClient(accountKey);
  }

  listAccounts(): string[] {
    return this.inner.listAccounts().filter((key) => {
      const { integration, account } = parseAccountKey(key);
      return this.hasPermission(integration, account);
    });
  }

  getTokenStore(): TokenStore {
    return this.inner.getTokenStore();
  }

  getRawClient(): OAuth2Client {
    return this.inner.getRawClient();
  }

  setCredentials(account: string, tokens: Parameters<OAuth2Client["setCredentials"]>[0]): OAuth2Client {
    const { integration, account: acct } = parseAccountKey(account);
    if (!this.hasPermission(integration, acct)) {
      throw new PermissionDeniedError(integration, acct);
    }
    return this.inner.setCredentials(account, tokens);
  }
}
