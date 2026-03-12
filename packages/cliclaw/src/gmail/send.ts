import { readFileSync } from "fs";
import { basename, extname } from "path";
import { google } from "googleapis";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { extToMime } from "../lib/media-utils.js";
import { outputJson, outputAuthRequired } from "../lib/output.js";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

interface AttachmentInput {
  file_path: string;
  filename?: string;
}

interface InMemoryAttachment {
  filename: string;
  mimeType: string;
  data: Buffer;
}

function encodeMessage(headers: Record<string, string>, body: string): string {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");
  const raw = `${headerLines}\r\n\r\n${body}`;
  return Buffer.from(raw).toString("base64url");
}

function buildAlternativePart(boundary: string, body: string, htmlBody: string): string {
  const altBoundary = `----=_Alt_${Date.now()}`;
  const altParts = [
    [
      `--${altBoundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      body,
    ].join("\r\n"),
    [
      `--${altBoundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      htmlBody,
    ].join("\r\n"),
  ];
  return [
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    altParts.join("\r\n") + `\r\n--${altBoundary}--`,
  ].join("\r\n");
}

function encodeMultipartMessage(
  headers: Record<string, string>,
  body: string,
  attachments: AttachmentInput[] | undefined,
  htmlBody?: string,
  inMemoryAttachments?: InMemoryAttachment[],
): string {
  const hasAttachments =
    (attachments && attachments.length > 0) ||
    (inMemoryAttachments && inMemoryAttachments.length > 0);

  if (!hasAttachments && !htmlBody) {
    return encodeMessage(headers, body);
  }

  if (!hasAttachments && htmlBody) {
    const altBoundary = `----=_Alt_${Date.now()}`;
    const multipartHeaders: Record<string, string> = {
      ...headers,
      "Content-Type": `multipart/alternative; boundary="${altBoundary}"`,
    };
    const headerLines = Object.entries(multipartHeaders)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\r\n");
    const parts = [
      [
        `--${altBoundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        body,
      ].join("\r\n"),
      [
        `--${altBoundary}`,
        "Content-Type: text/html; charset=utf-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        htmlBody,
      ].join("\r\n"),
    ];
    const rawBody = parts.join("\r\n") + `\r\n--${altBoundary}--`;
    const raw = `${headerLines}\r\n\r\n${rawBody}`;
    return Buffer.from(raw).toString("base64url");
  }

  const boundary = `----=_Part_${Date.now()}`;
  const multipartHeaders: Record<string, string> = {
    ...headers,
    "Content-Type": `multipart/mixed; boundary="${boundary}"`,
  };
  const headerLines = Object.entries(multipartHeaders)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\r\n");

  const parts: string[] = [];

  if (htmlBody) {
    parts.push(buildAlternativePart(boundary, body, htmlBody));
  } else {
    parts.push(
      [
        `--${boundary}`,
        "Content-Type: text/plain; charset=utf-8",
        "Content-Transfer-Encoding: quoted-printable",
        "",
        body,
      ].join("\r\n"),
    );
  }

  for (const att of attachments ?? []) {
    const fileBuffer = readFileSync(att.file_path);
    const name = att.filename ?? basename(att.file_path);
    const ext = extname(name);
    const mimeType = extToMime(ext) || "application/octet-stream";
    const encoded = fileBuffer.toString("base64");

    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${mimeType}; name="${name}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${name}"`,
        "",
        encoded,
      ].join("\r\n"),
    );
  }

  for (const att of inMemoryAttachments ?? []) {
    const encoded = att.data.toString("base64");
    parts.push(
      [
        `--${boundary}`,
        `Content-Type: ${att.mimeType}; name="${att.filename}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${att.filename}"`,
        "",
        encoded,
      ].join("\r\n"),
    );
  }

  const rawBody = parts.join("\r\n") + `\r\n--${boundary}--`;
  const raw = `${headerLines}\r\n\r\n${rawBody}`;
  return Buffer.from(raw).toString("base64url");
}

async function getSenderEmail(client: OAuth2Client): Promise<string> {
  const gmail = google.gmail({ version: "v1", auth: client });
  const res = await gmail.users.getProfile({ userId: "me" });
  return res.data.emailAddress ?? "me";
}

interface MessagePart {
  mimeType?: string | null;
  filename?: string | null;
  body?: { data?: string | null; attachmentId?: string | null } | null;
  parts?: MessagePart[] | null;
}

interface AttachmentMeta {
  filename: string;
  mimeType: string;
  attachmentId: string;
}

function extractPlainText(parts: MessagePart[] | null | undefined): string {
  let text = "";
  function traverse(part: MessagePart) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      for (const child of part.parts) traverse(child);
    }
  }
  if (parts) {
    for (const part of parts) traverse(part);
  }
  return text;
}

function extractAttachmentMeta(parts: MessagePart[] | null | undefined): AttachmentMeta[] {
  const results: AttachmentMeta[] = [];
  function traverse(part: MessagePart) {
    const attachmentId = part.body?.attachmentId ?? null;
    const filename = part.filename ?? null;
    if (attachmentId && filename) {
      results.push({
        filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        attachmentId,
      });
    }
    if (part.parts) {
      for (const child of part.parts) traverse(child);
    }
  }
  if (parts) {
    for (const part of parts) traverse(part);
  }
  return results;
}

export async function handleSend(
  clientManager: OAuthClientManager,
  account: string,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  htmlBody?: string,
  attachmentPaths?: string[],
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });
  const from = await getSenderEmail(client);

  const messageHeaders: Record<string, string> = {
    From: from,
    To: to,
    Subject: subject,
    "Content-Type": "text/plain; charset=utf-8",
    "MIME-Version": "1.0",
  };
  if (cc) messageHeaders["Cc"] = cc;
  if (bcc) messageHeaders["Bcc"] = bcc;

  const attachments: AttachmentInput[] | undefined = attachmentPaths?.map((p) => ({ file_path: p }));

  const raw = encodeMultipartMessage(messageHeaders, body, attachments, htmlBody);

  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  outputJson({ id: res.data.id, threadId: res.data.threadId, success: true });
}

export async function handleReply(
  clientManager: OAuthClientManager,
  account: string,
  id: string,
  body: string,
  replyAll?: boolean,
  htmlBody?: string,
  attachmentPaths?: string[],
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const orig = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "metadata",
    metadataHeaders: ["Subject", "From", "To", "Cc", "Message-ID", "References"],
  });

  const headers = orig.data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const origSubject = get("Subject");
  const origFrom = get("From");
  const origTo = get("To");
  const origCc = get("Cc");
  const origMessageId = get("Message-ID");
  const origReferences = get("References");
  const threadId = orig.data.threadId ?? undefined;

  const replySubject = origSubject.startsWith("Re:") ? origSubject : `Re: ${origSubject}`;
  const references = origReferences ? `${origReferences} ${origMessageId}` : origMessageId;

  const from = await getSenderEmail(client);

  const replyHeaders: Record<string, string> = {
    From: from,
    To: origFrom,
    Subject: replySubject,
    "In-Reply-To": origMessageId,
    References: references,
    "Content-Type": "text/plain; charset=utf-8",
    "MIME-Version": "1.0",
  };

  if (replyAll) {
    const allCcAddresses = [origTo, origCc]
      .filter(Boolean)
      .join(", ")
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a && !a.toLowerCase().includes(from.toLowerCase()));
    if (allCcAddresses.length > 0) {
      replyHeaders["Cc"] = allCcAddresses.join(", ");
    }
  }

  const attachments: AttachmentInput[] | undefined = attachmentPaths?.map((p) => ({ file_path: p }));

  const raw = encodeMultipartMessage(replyHeaders, body, attachments, htmlBody);

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId },
  });

  outputJson({ id: res.data.id, threadId: res.data.threadId, success: true });
}

export async function handleForward(
  clientManager: OAuthClientManager,
  account: string,
  id: string,
  to: string,
  body?: string,
  attachmentPaths?: string[],
): Promise<void> {
  if (!clientManager.listAccounts().includes(account)) {
    outputAuthRequired();
  }

  const client = clientManager.getClient(account);
  const gmail = google.gmail({ version: "v1", auth: client });

  const orig = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  const headers = orig.data.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const origSubject = get("Subject");
  const origFrom = get("From");
  const origDate = get("Date");

  const fwdSubject = origSubject.startsWith("Fwd:") ? origSubject : `Fwd: ${origSubject}`;

  let origBody = "";
  if (orig.data.payload?.body?.data) {
    origBody = Buffer.from(orig.data.payload.body.data, "base64").toString("utf-8");
  } else {
    origBody = extractPlainText(orig.data.payload?.parts as MessagePart[] | undefined);
  }

  const quotedBody = [
    body ?? "",
    "",
    "---------- Forwarded message ---------",
    `From: ${origFrom}`,
    `Date: ${origDate}`,
    `Subject: ${origSubject}`,
    "",
    origBody,
  ]
    .join("\r\n")
    .trimStart();

  // Fetch original attachments
  const origAttachmentMetas = extractAttachmentMeta(
    orig.data.payload?.parts as MessagePart[] | undefined,
  );
  const origInMemoryAttachments: InMemoryAttachment[] = [];
  for (const meta of origAttachmentMetas) {
    const attRes = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: id,
      id: meta.attachmentId,
    });
    const data = attRes.data.data;
    if (data) {
      origInMemoryAttachments.push({
        filename: meta.filename,
        mimeType: meta.mimeType,
        data: Buffer.from(data, "base64url"),
      });
    }
  }

  const from = await getSenderEmail(client);
  const fileAttachments: AttachmentInput[] | undefined = attachmentPaths?.map((p) => ({ file_path: p }));

  const raw = encodeMultipartMessage(
    {
      From: from,
      To: to,
      Subject: fwdSubject,
      "Content-Type": "text/plain; charset=utf-8",
      "MIME-Version": "1.0",
    },
    quotedBody,
    fileAttachments,
    undefined,
    origInMemoryAttachments.length > 0 ? origInMemoryAttachments : undefined,
  );

  const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  outputJson({ id: res.data.id, threadId: res.data.threadId, success: true });
}
