import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson } from "../lib/output.js";

export async function handleAccounts(clientManager: OAuthClientManager): Promise<void> {
  const allAccounts = clientManager.listAccounts();
  const formsAccounts = allAccounts.filter((a) => a.startsWith("forms:"));

  const accounts = await Promise.all(
    formsAccounts.map(async (tokenKey) => {
      const account = tokenKey.replace("forms:", "");
      try {
        const client = clientManager.getClient(tokenKey);
        const oauth2 = google.oauth2({ version: "v2", auth: client });
        const res = await oauth2.userinfo.get();
        return { account, email: res.data.email ?? null };
      } catch {
        return { account, email: null };
      }
    }),
  );

  outputJson({ accounts });
}
