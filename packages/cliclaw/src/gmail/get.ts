import { writeFileSync } from "fs";
import * as path from "path";
import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { ensureDir, sanitizeFilename, extToMime } from "../lib/media-utils.js";
import { outputJson, outputAuthRequired, outputError } from "../lib/output.js";

interface MessagePart {
  partId?: string | null;
  mimeType?: string | null;
  filename?: string | null;
  headers?: Array<{ name?: string | null; value?: string | null }> | null;
  body?: { data?: string | null; attachmentId?: string | null; size?: number | null } | null;
  parts?: MessagePart[] | null;
}

interface AttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  partId: string;
}

function extractBody(parts: MessagePart[] | null | undefined): { text: string; html: string } {
  let text = "";
  let html = "";

  function traverse(part: MessagePart) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64").toString("utf-8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html += Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      for (const child of part.parts) {
        traverse(child);
      }
    }
  }

  if (parts) {
    for (const part of parts) {
      traverse(part);
    }
  }

  return { text, html };
}

function extractAttachments(parts: MessagePart[] | null | undefined): AttachmentMeta[] {
  const results: AttachmentMeta[] = [];

  function traverse(part: MessagePart) {
    const attachmentId = part.body?.attachmentId ?? null;
    const filenameHeader = part.headers?.find(
      (h) => h.name?.toLowerCase() === "content-disposition",
    )?.value;

    let filename = part.filename ?? null;
    if (!filename && filenameHeader) {
      const match = filenameHeader.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      if (match) {
        filename = decodeURIComponent(match[1].trim());
      }
    }

    if (attachmentId && filename) {
      results.push({
        filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        size: part.body?.size ?? 0,
        attachmentId,
        partId: part.partId ?? "",
      });
    }

    if (part.parts) {
      for (const child of part.parts) {
        traverse(child);
      }
    }
  }

  if (parts) {
    for (const part of parts) {
      traverse(part);
    }
  }

  return results;
}

export async function handleGet(
  clientManager: OAuthClientManager,
  account: string,
  id: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  const payload = res.data.payload;
  const headers = payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  let bodyText = "";
  let bodyHtml = "";

  if (payload?.body?.data) {
    const decoded = Buffer.from(payload.body.data, "base64").toString("utf-8");
    if (payload.mimeType === "text/html") {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
  } else {
    const { text, html } = extractBody(payload?.parts as MessagePart[] | undefined);
    bodyText = text;
    bodyHtml = html;
  }

  const attachments = extractAttachments(payload?.parts as MessagePart[] | undefined);

  outputJson({
    id: res.data.id ?? id,
    threadId: res.data.threadId ?? "",
    subject: get("Subject"),
    from: get("From"),
    to: get("To"),
    cc: get("Cc"),
    bcc: get("Bcc"),
    reply_to: get("Reply-To"),
    date: get("Date"),
    snippet: res.data.snippet ?? "",
    labelIds: res.data.labelIds ?? [],
    body_text: bodyText,
    body_html: bodyHtml,
    attachments,
  });
}

export async function handleDownloadAttachment(
  clientManager: OAuthClientManager,
  account: string,
  id: string,
  attachmentId: string,
  filename: string,
  saveDir: string,
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId: id,
    id: attachmentId,
  });

  const data = res.data.data;
  if (!data) {
    outputError("no_data", "Attachment returned no data.");
  }

  const buffer = Buffer.from(data!, "base64url");

  ensureDir(saveDir);
  const safeFilename = sanitizeFilename(filename);
  const filePath = path.join(saveDir, safeFilename);
  writeFileSync(filePath, buffer);

  const ext = path.extname(safeFilename);
  const mimeType = extToMime(ext) || "application/octet-stream";

  outputJson({
    path: filePath,
    filename: safeFilename,
    mimeType,
    size: buffer.length,
  });
}
