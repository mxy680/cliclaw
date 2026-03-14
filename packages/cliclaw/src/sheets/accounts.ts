import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson } from "../lib/output.js";

export async function handleAccounts(clientManager: OAuthClientManager): Promise<void> {
  const allAccounts = clientManager.listAccounts();
  const gsheetsAccounts = allAccounts.filter((a) => a.startsWith("gsheets:"));

  const accounts = await Promise.all(
    gsheetsAccounts.map(async (tokenKey) => {
      const account = tokenKey.replace("gsheets:", "");
      try {
        const client = clientManager.getClient(tokenKey);
        const drive = google.drive({ version: "v3", auth: client });
        const about = await drive.about.get({ fields: "user" });
        return { account, email: about.data.user?.emailAddress ?? null };
      } catch {
        return { account, email: null };
      }
    }),
  );

  outputJson({ accounts });
}
