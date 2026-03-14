import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { waitForOAuthCallback, getCalendarAuthUrl } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAuth(clientManager: OAuthClientManager, port: number, account: string): Promise<void> {
  const tokenKey = `calendar:${account}`;

  // Check if already authenticated
  try {
    const client = clientManager.getClient(tokenKey);
    const creds = client.credentials;
    if (creds && (creds.refresh_token || creds.access_token)) {
      const calendar = google.calendar({ version: "v3", auth: client });
      const res = await calendar.calendarList.list({ maxResults: 1 });
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
      console.error(`Opening browser for Google Calendar authentication...`);
      console.error(url);
      open(url).catch(() => {
        console.error("Could not open browser. Please visit the URL above manually.");
      });
    }, getCalendarAuthUrl);

    clientManager.setCredentials(tokenKey, tokens);

    outputJson({ status: "authenticated", account });
  } catch (err) {
    outputError("auth_failed", err instanceof Error ? err.message : String(err));
  }
}
