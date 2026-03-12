import { TokenStore, OAuthClientManager, AgentStore, loadConfig, getTokensPath, getAgentsDir } from "@cliclaw/auth";

export function getTokenStore(): TokenStore {
  return new TokenStore(getTokensPath());
}

export function getAgentStore(): AgentStore {
  return new AgentStore(getAgentsDir());
}

export function getDashboardAuth(): OAuthClientManager {
  const config = loadConfig();
  const tokenStore = getTokenStore();
  const redirectUri = "http://localhost:3000/api/oauth/callback";
  return new OAuthClientManager(config.client_secret_path, redirectUri, tokenStore);
}
