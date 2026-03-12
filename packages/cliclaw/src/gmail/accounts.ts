import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson } from "../lib/output.js";

export async function handleAccounts(clientManager: OAuthClientManager): Promise<void> {
  const accountNames = clientManager.listAccounts();

  const accounts = await Promise.all(
    accountNames.map(async (account) => {
      try {
        const client = clientManager.getClient(account);
        const gmail = google.gmail({ version: "v1", auth: client });
        const res = await gmail.users.getProfile({ userId: "me" });
        return { account, email: res.data.emailAddress ?? null };
      } catch {
        return { account, email: null };
      }
    }),
  );

  outputJson({ accounts });
}
