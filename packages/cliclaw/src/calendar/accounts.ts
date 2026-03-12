import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson } from "../lib/output.js";

export async function handleAccounts(clientManager: OAuthClientManager): Promise<void> {
  const allAccounts = clientManager.listAccounts();
  const calendarAccounts = allAccounts.filter((a) => a.startsWith("calendar:"));

  const accounts = await Promise.all(
    calendarAccounts.map(async (tokenKey) => {
      const account = tokenKey.replace("calendar:", "");
      try {
        const client = clientManager.getClient(tokenKey);
        const calendar = google.calendar({ version: "v3", auth: client });
        const res = await calendar.calendarList.list({ maxResults: 1 });
        const primary = res.data.items?.find((c) => c.primary);
        return { account, email: primary?.id ?? null };
      } catch {
        return { account, email: null };
      }
    }),
  );

  outputJson({ accounts });
}
