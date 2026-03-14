import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getDrive(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("gdrive");
  }
  return google.drive({ version: "v3", auth: client });
}

export async function handleShare(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
  email: string,
  role: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.permissions.create({
      fileId,
      requestBody: {
        type: "user",
        role,
        emailAddress: email,
      },
      fields: "id, type, role, emailAddress",
    });

    outputJson({ success: true, fileId, permission: res.data });
  } catch (err) {
    outputError("share_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleUnshare(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
  permissionId: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    await drive.permissions.delete({ fileId, permissionId });
    outputJson({ success: true, fileId, permissionId });
  } catch (err) {
    outputError("unshare_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handlePermissions(
  clientManager: OAuthClientManager,
  account: string,
  fileId: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.permissions.list({
      fileId,
      fields: "permissions(id, type, role, emailAddress, displayName)",
    });

    outputJson({ fileId, permissions: res.data.permissions ?? [] });
  } catch (err) {
    outputError("permissions_failed", err instanceof Error ? err.message : String(err));
  }
}
