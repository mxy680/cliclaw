import { google } from "googleapis";
import { createOAuthClient } from "./gmail-auth.js";
import { TokenStore } from "./token-store.js";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export class OAuthClientManager {
  private clients = new Map<string, OAuth2Client>();

  constructor(
    private clientSecretPath: string,
    private redirectUri: string,
    private tokenStore: TokenStore,
  ) {}

  getClient(account: string): OAuth2Client {
    const existing = this.clients.get(account);
    if (existing) return existing;

    const client = createOAuthClient(this.clientSecretPath, this.redirectUri);
    const tokens = this.tokenStore.get(account);
    if (tokens) {
      client.setCredentials(tokens);
    }

    client.on("tokens", (refreshed) => {
      const current = this.tokenStore.get(account) ?? {};
      this.tokenStore.set(account, { ...current, ...refreshed });
    });

    this.clients.set(account, client);
    return client;
  }

  getRawClient(): OAuth2Client {
    return createOAuthClient(this.clientSecretPath, this.redirectUri);
  }

  setCredentials(
    account: string,
    tokens: Parameters<OAuth2Client["setCredentials"]>[0],
  ): OAuth2Client {
    const client = createOAuthClient(this.clientSecretPath, this.redirectUri);
    client.setCredentials(tokens);

    client.on("tokens", (refreshed) => {
      const current = this.tokenStore.get(account) ?? {};
      this.tokenStore.set(account, { ...current, ...refreshed });
    });

    this.tokenStore.set(account, tokens);
    this.clients.set(account, client);
    return client;
  }

  getTokenStore(): TokenStore {
    return this.tokenStore;
  }

  listAccounts(): string[] {
    return this.tokenStore.list();
  }
}
