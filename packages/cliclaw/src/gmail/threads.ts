import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputAuthRequired } from "../lib/output.js";

export async function handleThreadList(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
  query?: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.threads.list({
    userId: "me",
    maxResults,
    ...(query ? { q: query } : {}),
  });

  const threads = res.data.threads ?? [];

  const result = threads.map((thread) => ({
    id: thread.id ?? "",
    snippet: thread.snippet ?? "",
    historyId: thread.historyId ?? "",
  }));

  outputJson(result);
}

export async function handleThreadGet(
  clientManager: OAuthClientManager,
  account: string,
  threadId: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["Subject", "From", "Date"],
  });

  const messages = (res.data.messages ?? []).map((msg) => {
    const headers = msg.payload?.headers ?? [];
    const get = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
    return {
      id: msg.id ?? "",
      subject: get("Subject"),
      from: get("From"),
      date: get("Date"),
      snippet: msg.snippet ?? "",
    };
  });

  outputJson({ id: res.data.id ?? threadId, messages });
}
