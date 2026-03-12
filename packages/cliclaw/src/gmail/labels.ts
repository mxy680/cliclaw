import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { outputJson, outputAuthRequired } from "../lib/output.js";

export async function handleLabelsList(
  clientManager: OAuthClientManager,
  account: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.labels.list({ userId: "me" });
  const labels = res.data.labels ?? [];

  const result = labels.map((label) => ({
    id: label.id ?? "",
    name: label.name ?? "",
    type: label.type ?? "",
    messagesTotal: label.messagesTotal ?? 0,
    messagesUnread: label.messagesUnread ?? 0,
  }));

  outputJson(result);
}

export async function handleLabelCreate(
  clientManager: OAuthClientManager,
  account: string,
  name: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });

  outputJson({ id: res.data.id, name: res.data.name, success: true });
}

export async function handleLabelDelete(
  clientManager: OAuthClientManager,
  account: string,
  labelId: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  await gmail.users.labels.delete({ userId: "me", id: labelId });

  outputJson({ label_id: labelId, success: true });
}
