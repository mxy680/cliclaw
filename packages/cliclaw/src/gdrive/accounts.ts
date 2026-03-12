import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson } from "../lib/output.js";

export async function handleAccounts(clientManager: OAuthClientManager): Promise<void> {
  const allAccounts = clientManager.listAccounts();
  const gdriveAccounts = allAccounts.filter((a) => a.startsWith("gdrive:"));

  const accounts = await Promise.all(
    gdriveAccounts.map(async (tokenKey) => {
      const account = tokenKey.replace("gdrive:", "");
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
