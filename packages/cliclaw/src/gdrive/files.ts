import { google } from "googleapis";
import { createReadStream, createWriteStream, statSync } from "fs";
import { basename, join } from "path";
import { lookup } from "mime-types";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getDrive(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("gdrive");
  }
  return google.drive({ version: "v3", auth: client });
}

export async function handleList(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
  query?: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const q = query ? query : "trashed = false";
    const res = await drive.files.list({
      q,
      pageSize: maxResults,
      fields: "files(id, name, mimeType, size, modifiedTime, parents, webViewLink)",
      orderBy: "modifiedTime desc",
    });
    outputJson(res.data.files ?? []);
  } catch (err) {
    outputError("list_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleGet(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, modifiedTime, createdTime, parents, webViewLink, description, starred, trashed, owners, permissions",
    });
    outputJson(res.data);
  } catch (err) {
    outputError("get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDownload(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
  saveDir: string,
  filename?: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);

    // Get file metadata for name
    const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
    const saveName = filename ?? meta.data.name ?? fileId;
    const savePath = join(saveDir, saveName);

    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" },
    );

    await new Promise<void>((resolve, reject) => {
      const dest = createWriteStream(savePath);
      (res.data as NodeJS.ReadableStream)
        .pipe(dest)
        .on("finish", resolve)
        .on("error", reject);
    });

    outputJson({ success: true, path: savePath, name: saveName });
  } catch (err) {
    outputError("download_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleUpload(
  clientManager: OAuthClientManager,
  account: string,
  filePath: string,
  name?: string,
  parentId?: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const fileName = name ?? basename(filePath);
    const mimeType = lookup(filePath) || "application/octet-stream";

    const fileMetadata: { name: string; parents?: string[] } = { name: fileName };
    if (parentId) fileMetadata.parents = [parentId];

    const res = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: createReadStream(filePath),
      },
      fields: "id, name, mimeType, size, webViewLink",
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("upload_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDelete(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    await drive.files.delete({ fileId });
    outputJson({ success: true, fileId });
  } catch (err) {
    outputError("delete_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleTrash(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    await drive.files.update({ fileId, requestBody: { trashed: true } });
    outputJson({ success: true, fileId, action: "trash" });
  } catch (err) {
    outputError("trash_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleUntrash(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    await drive.files.update({ fileId, requestBody: { trashed: false } });
    outputJson({ success: true, fileId, action: "untrash" });
  } catch (err) {
    outputError("untrash_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleMove(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
  newParentId: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);

    // Get current parents
    const file = await drive.files.get({ fileId, fields: "parents" });
    const previousParents = (file.data.parents ?? []).join(",");

    const res = await drive.files.update({
      fileId,
      addParents: newParentId,
      removeParents: previousParents,
      fields: "id, name, parents",
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("move_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleCopy(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
  name?: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const requestBody: { name?: string } = {};
    if (name) requestBody.name = name;

    const res = await drive.files.copy({
      fileId,
      requestBody,
      fields: "id, name, mimeType, size, webViewLink",
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("copy_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleRename(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
  name: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.files.update({
      fileId,
      requestBody: { name },
      fields: "id, name, mimeType",
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("rename_failed", err instanceof Error ? err.message : String(err));
  }
}
