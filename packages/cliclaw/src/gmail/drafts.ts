import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputAuthRequired } from "../lib/output.js";

function encodeDraftMessage(headers: Record<string, string>, body: string): string {
  const headerLines = Object.entries(headers)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");
  const raw = `${headerLines}\r\n\r\n${body}`;
  return Buffer.from(raw).toString("base64url");
}

export async function handleDraftList(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const listRes = await gmail.users.drafts.list({ userId: "me", maxResults });
  const drafts = listRes.data.drafts ?? [];

  if (drafts.length === 0) {
    outputJson([]);
    return;
  }

  const summaries = await Promise.all(
    drafts.map(async (draft) => {
      const detail = await gmail.users.drafts.get({
        userId: "me",
        id: draft.id!,
        format: "metadata",
      });
      const headers = detail.data.message?.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id: draft.id ?? "",
        messageId: detail.data.message?.id ?? "",
        subject: get("Subject"),
        to: get("To"),
        snippet: detail.data.message?.snippet ?? "",
      };
    }),
  );

  outputJson(summaries);
}

export async function handleDraftCreate(
  clientManager: OAuthClientManager,
  account: string,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const raw = encodeDraftMessage(
    {
      To: to,
      Subject: subject,
      Cc: cc ?? "",
      Bcc: bcc ?? "",
      "Content-Type": "text/plain; charset=utf-8",
      "MIME-Version": "1.0",
    },
    body,
  );

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw } },
  });

  outputJson({ id: res.data.id, messageId: res.data.message?.id, success: true });
}

export async function handleDraftUpdate(
  clientManager: OAuthClientManager,
  account: string,
  draftId: string,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const raw = encodeDraftMessage(
    {
      To: to,
      Subject: subject,
      Cc: cc ?? "",
      Bcc: bcc ?? "",
      "Content-Type": "text/plain; charset=utf-8",
      "MIME-Version": "1.0",
    },
    body,
  );

  const res = await gmail.users.drafts.update({
    userId: "me",
    id: draftId,
    requestBody: { message: { raw } },
  });

  outputJson({ id: res.data.id, messageId: res.data.message?.id, success: true });
}

export async function handleDraftDelete(
  clientManager: OAuthClientManager,
  account: string,
  draftId: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  await gmail.users.drafts.delete({ userId: "me", id: draftId });

  outputJson({ draft_id: draftId, success: true });
}

export async function handleDraftSend(
  clientManager: OAuthClientManager,
  account: string,
  draftId: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });

  outputJson({ id: res.data.id, threadId: res.data.threadId, success: true });
}
