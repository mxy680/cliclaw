import { TokenStore, OAuthClientManager, loadConfig, getTokensPath } from "@cliclaw/auth";

export function getTokenStore(): TokenStore {
  return new TokenStore(getTokensPath());
}

export function getDashboardAuth(): OAuthClientManager {
  const config = loadConfig();
  const tokenStore = getTokenStore();
  const redirectUri = "http://localhost:3000/api/oauth/callback";
  return new OAuthClientManager(config.client_secret_path, redirectUri, tokenStore);
}
