import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { waitForOAuthCallback, getGSheetsAuthUrl } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAuth(clientManager: OAuthClientManager, port: number, account: string): Promise<void> {
  const tokenKey = `gsheets:${account}`;

  try {
    const client = clientManager.getClient(tokenKey);
    const creds = client.credentials;
    if (creds && (creds.refresh_token || creds.access_token)) {
      const sheets = google.sheets({ version: "v4", auth: client });
      // Validate by getting a simple response
      await sheets.spreadsheets.create({
        requestBody: { properties: { title: "__auth_check__" } },
      }).then(() => {}).catch(() => {});
      // Actually just check drive about for email
      const drive = google.drive({ version: "v3", auth: client });
      const about = await drive.about.get({ fields: "user" });
      outputJson({
        status: "already_authenticated",
        account,
        email: about.data.user?.emailAddress ?? "unknown",
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
      console.error(`Opening browser for Google Sheets authentication...`);
      console.error(url);
      open(url).catch(() => {
        console.error("Could not open browser. Please visit the URL above manually.");
      });
    }, getGSheetsAuthUrl);

    const client = clientManager.setCredentials(tokenKey, tokens);

    const drive = google.drive({ version: "v3", auth: client });
    let email = "unknown";
    try {
      const about = await drive.about.get({ fields: "user" });
      email = about.data.user?.emailAddress ?? "unknown";
    } catch {
      // Non-fatal
    }

    outputJson({ status: "authenticated", account, email });
  } catch (err) {
    outputError("auth_failed", err instanceof Error ? err.message : String(err));
  }
}
