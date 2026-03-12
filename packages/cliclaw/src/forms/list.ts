import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getDrive(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("forms");
  }
  return google.drive({ version: "v3", auth: client });
}

export async function handleList(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.files.list({
      pageSize: maxResults,
      q: "mimeType='application/vnd.google-apps.form' and trashed=false",
      fields: "files(id,name,createdTime,modifiedTime,webViewLink)",
      orderBy: "modifiedTime desc",
    });
    const forms = (res.data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      webViewLink: f.webViewLink,
    }));
    outputJson(forms);
  } catch (err) {
    outputError("list_forms_failed", err instanceof Error ? err.message : String(err));
  }
}
