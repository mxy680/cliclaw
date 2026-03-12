import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

export async function handleSearch(
  clientManager: OAuthClientManager,
  account: string,
  query: string,
  maxResults: number,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const client = clientManager.getClient(tokenKey);
    if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
      outputAuthRequired("gdrive");
    }
    const drive = google.drive({ version: "v3", auth: client });

    const res = await drive.files.list({
      q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
      pageSize: maxResults,
      fields: "files(id, name, mimeType, size, modifiedTime, parents, webViewLink)",
      orderBy: "modifiedTime desc",
    });

    outputJson(res.data.files ?? []);
  } catch (err) {
    outputError("search_failed", err instanceof Error ? err.message : String(err));
  }
}
