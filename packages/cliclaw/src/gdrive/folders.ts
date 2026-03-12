import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getDrive(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("gdrive");
  }
  return google.drive({ version: "v3", auth: client });
}

export async function handleMkdir(
  clientManager: OAuthClientManager,
  account: string,
  name: string,
  parentId?: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
      name,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentId) fileMetadata.parents = [parentId];

    const res = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id, name, mimeType, webViewLink",
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("mkdir_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleListFolder(
  clientManager: OAuthClientManager,
  account: string,
  folderId: string,
  maxResults: number,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: maxResults,
      fields: "files(id, name, mimeType, size, modifiedTime, webViewLink)",
      orderBy: "folder,name",
    });
    outputJson(res.data.files ?? []);
  } catch (err) {
    outputError("list_folder_failed", err instanceof Error ? err.message : String(err));
  }
}
