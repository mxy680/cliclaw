import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { waitForOAuthCallback } from "../auth/oauth-server.js";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAuth(clientManager: OAuthClientManager, port: number, account: string): Promise<void> {
  // Check if already authenticated
  try {
    const client = clientManager.getClient(account);
    const creds = client.credentials;
    if (creds && (creds.refresh_token || creds.access_token)) {
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const info = await oauth2.userinfo.get();
      outputJson({
        status: "already_authenticated",
        account,
        email: info.data.email ?? "unknown",
        message: "Existing session is still valid. No re-authentication needed.",
      });
      return;
    }
  } catch {
    // Tokens invalid — proceed with re-auth
  }

  try {
    const open = (await import("open")).default;
    const rawClient = clientManager.getRawClient();

    const tokens = await waitForOAuthCallback(rawClient, port, (url) => {
      console.error(`Opening browser for authentication...`);
      console.error(url);
      open(url).catch(() => {
        console.error("Could not open browser. Please visit the URL above manually.");
      });
    });

    const client = clientManager.setCredentials(account, tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    let email = "unknown";
    try {
      const info = await oauth2.userinfo.get();
      email = info.data.email ?? "unknown";
    } catch {
      // Non-fatal
    }

    outputJson({ status: "authenticated", account, email });
  } catch (err) {
    outputError("auth_failed", err instanceof Error ? err.message : String(err));
  }
}
