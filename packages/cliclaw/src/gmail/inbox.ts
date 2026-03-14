import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputAuthRequired } from "../lib/output.js";

interface MessageSummary {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

async function fetchMessages(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
  query?: string,
  labelIds?: string[],
): Promise<MessageSummary[]> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    ...(labelIds ? { labelIds } : {}),
    maxResults,
    ...(query ? { q: query } : {}),
  });

  const messages = listRes.data.messages ?? [];
  if (messages.length === 0) return [];

  const summaries = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });
      const headers = detail.data.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
      return {
        id: msg.id ?? "",
        subject: get("Subject"),
        from: get("From"),
        date: get("Date"),
        snippet: detail.data.snippet ?? "",
      };
    }),
  );

  return summaries;
}

export async function handleInbox(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
): Promise<void> {
  const result = await fetchMessages(clientManager, account, maxResults, undefined, ["INBOX"]);
  outputJson(result);
}

export async function handleSearch(
  clientManager: OAuthClientManager,
  account: string,
  query: string,
  maxResults: number,
): Promise<void> {
  const result = await fetchMessages(clientManager, account, maxResults, query);
  outputJson(result);
}
