import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { waitForOAuthCallback, getFormsAuthUrl } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAuth(clientManager: OAuthClientManager, port: number, account: string): Promise<void> {
  const tokenKey = `forms:${account}`;

  // Check if already authenticated
  try {
    const client = clientManager.getClient(tokenKey);
    const creds = client.credentials;
    if (creds && (creds.refresh_token || creds.access_token)) {
      const drive = google.drive({ version: "v3", auth: client });
      await drive.files.list({ pageSize: 1, q: "mimeType='application/vnd.google-apps.form'" });
      outputJson({
        status: "already_authenticated",
        account,
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
      console.error(`Opening browser for Google Forms authentication...`);
      console.error(url);
      open(url).catch(() => {
        console.error("Could not open browser. Please visit the URL above manually.");
      });
    }, getFormsAuthUrl);

    clientManager.setCredentials(tokenKey, tokens);

    outputJson({ status: "authenticated", account });
  } catch (err) {
    outputError("auth_failed", err instanceof Error ? err.message : String(err));
  }
}
