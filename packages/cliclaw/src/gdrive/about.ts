import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

export async function handleAbout(
  clientManager: OAuthClientManager,
  account: string,
): Promise<void> {
  const tokenKey = `gdrive:${account}`;
  try {
    const client = clientManager.getClient(tokenKey);
    if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
      outputAuthRequired("gdrive");
    }
    const drive = google.drive({ version: "v3", auth: client });

    const res = await drive.about.get({
      fields: "user, storageQuota",
    });

    const quota = res.data.storageQuota;
    outputJson({
      user: res.data.user,
      storageQuota: quota
        ? {
            limit: quota.limit ? `${(Number(quota.limit) / 1e9).toFixed(2)} GB` : "unlimited",
            usage: `${(Number(quota.usage ?? 0) / 1e9).toFixed(2)} GB`,
            usageInDrive: `${(Number(quota.usageInDrive ?? 0) / 1e9).toFixed(2)} GB`,
            usageInDriveTrash: `${(Number(quota.usageInDriveTrash ?? 0) / 1e9).toFixed(2)} GB`,
          }
        : null,
    });
  } catch (err) {
    outputError("about_failed", err instanceof Error ? err.message : String(err));
  }
}
