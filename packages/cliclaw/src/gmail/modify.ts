import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputAuthRequired } from "../lib/output.js";

type ModifyAction =
  | "mark_read"
  | "mark_unread"
  | "archive"
  | "trash"
  | "untrash"
  | "star"
  | "unstar"
  | "add_labels"
  | "remove_labels";

export async function handleModify(
  clientManager: OAuthClientManager,
  account: string,
  id: string,
  action: ModifyAction,
  labelIds?: string[],
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  switch (action) {
    case "mark_read":
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: ["UNREAD"] },
      });
      break;
    case "mark_unread":
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { addLabelIds: ["UNREAD"] },
      });
      break;
    case "archive":
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: ["INBOX"] },
      });
      break;
    case "trash":
      await gmail.users.messages.trash({ userId: "me", id });
      break;
    case "untrash":
      await gmail.users.messages.untrash({ userId: "me", id });
      break;
    case "star":
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { addLabelIds: ["STARRED"] },
      });
      break;
    case "unstar":
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: ["STARRED"] },
      });
      break;
    case "add_labels":
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { addLabelIds: labelIds ?? [] },
      });
      break;
    case "remove_labels":
      await gmail.users.messages.modify({
        userId: "me",
        id,
        requestBody: { removeLabelIds: labelIds ?? [] },
      });
      break;
  }

  outputJson({ id, action, success: true });
}
