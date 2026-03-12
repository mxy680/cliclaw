import { Command } from "commander";
import type { OAuthClientManager } from "../auth/oauth-client-manager.js";
import { handleAuth } from "../gmail/auth.js";
import { handleAccounts } from "../gmail/accounts.js";
import { handleInbox, handleSearch } from "../gmail/inbox.js";
import { handleGet, handleDownloadAttachment } from "../gmail/get.js";
import { handleSend, handleReply, handleForward } from "../gmail/send.js";
import { handleModify } from "../gmail/modify.js";
import { handleDraftList, handleDraftCreate, handleDraftUpdate, handleDraftDelete, handleDraftSend } from "../gmail/drafts.js";
import { handleLabelsList, handleLabelCreate, handleLabelDelete } from "../gmail/labels.js";
import { handleThreadList, handleThreadGet } from "../gmail/threads.js";

type ClientFactory = () => { clientManager: OAuthClientManager; port: number };

export function registerGmailCommands(program: Command, getClient: ClientFactory): void {
  // Cache so we only call the factory once
  let cached: { clientManager: OAuthClientManager; port: number } | null = null;
  function resolve() {
    if (!cached) cached = getClient();
    return cached;
  }

  const gmail = program.command("gmail").description("Gmail commands");

  gmail
    .command("auth")
    .description("Authenticate with Gmail via Google OAuth2")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager, port } = resolve();
      await handleAuth(clientManager, port, opts.account);
    });

  gmail
    .command("accounts")
    .description("List authenticated Gmail accounts")
    .action(async () => {
      const { clientManager } = resolve();
      await handleAccounts(clientManager);
    });

  gmail
    .command("inbox")
    .description("List recent inbox messages")
    .option("--max-results <n>", "Maximum messages to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleInbox(clientManager, opts.account, parseInt(opts.maxResults));
    });

  gmail
    .command("search")
    .description("Search Gmail messages")
    .requiredOption("--query <query>", "Gmail search query")
    .option("--max-results <n>", "Maximum messages to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleSearch(clientManager, opts.account, opts.query, parseInt(opts.maxResults));
    });

  gmail
    .command("get")
    .description("Get full message by ID")
    .requiredOption("--id <id>", "Gmail message ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGet(clientManager, opts.account, opts.id);
    });

  gmail
    .command("send")
    .description("Send a new email")
    .requiredOption("--to <address>", "Recipient email")
    .requiredOption("--subject <subject>", "Email subject")
    .requiredOption("--body <text>", "Plain-text body")
    .option("--cc <addresses>", "CC recipients")
    .option("--bcc <addresses>", "BCC recipients")
    .option("--html-body <html>", "HTML body")
    .option("--attachment <path>", "File attachment path (repeatable)", (val: string, prev: string[]) => prev.concat(val), [] as string[])
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleSend(
        clientManager,
        opts.account,
        opts.to,
        opts.subject,
        opts.body,
        opts.cc,
        opts.bcc,
        opts.htmlBody,
        opts.attachment.length > 0 ? opts.attachment : undefined,
      );
    });

  gmail
    .command("reply")
    .description("Reply to an existing message")
    .requiredOption("--id <id>", "Message ID to reply to")
    .requiredOption("--body <text>", "Reply body")
    .option("--reply-all", "Reply to all recipients")
    .option("--html-body <html>", "HTML reply body")
    .option("--attachment <path>", "File attachment path (repeatable)", (val: string, prev: string[]) => prev.concat(val), [] as string[])
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleReply(
        clientManager,
        opts.account,
        opts.id,
        opts.body,
        opts.replyAll,
        opts.htmlBody,
        opts.attachment.length > 0 ? opts.attachment : undefined,
      );
    });

  gmail
    .command("forward")
    .description("Forward a message")
    .requiredOption("--id <id>", "Message ID to forward")
    .requiredOption("--to <address>", "Recipient to forward to")
    .option("--body <text>", "Introductory note")
    .option("--attachment <path>", "File attachment path (repeatable)", (val: string, prev: string[]) => prev.concat(val), [] as string[])
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleForward(
        clientManager,
        opts.account,
        opts.id,
        opts.to,
        opts.body,
        opts.attachment.length > 0 ? opts.attachment : undefined,
      );
    });

  gmail
    .command("modify")
    .description("Modify message state (read/unread/archive/trash/star/labels)")
    .requiredOption("--id <id>", "Message ID")
    .requiredOption("--action <action>", "Action: mark_read, mark_unread, archive, trash, untrash, star, unstar, add_labels, remove_labels")
    .option("--label-ids <ids...>", "Label IDs for add_labels/remove_labels")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleModify(clientManager, opts.account, opts.id, opts.action, opts.labelIds);
    });

  gmail
    .command("download-attachment")
    .description("Download an email attachment")
    .requiredOption("--id <id>", "Message ID")
    .requiredOption("--attachment-id <aid>", "Attachment ID")
    .requiredOption("--filename <name>", "Filename to save as")
    .requiredOption("--save-dir <dir>", "Directory to save to")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDownloadAttachment(
        clientManager,
        opts.account,
        opts.id,
        opts.attachmentId,
        opts.filename,
        opts.saveDir,
      );
    });

  // Drafts subcommand group
  const drafts = gmail.command("drafts").description("Draft management");

  drafts
    .command("list")
    .description("List drafts")
    .option("--max-results <n>", "Maximum drafts to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDraftList(clientManager, opts.account, parseInt(opts.maxResults));
    });

  drafts
    .command("create")
    .description("Create a new draft")
    .requiredOption("--to <address>", "Recipient email")
    .requiredOption("--subject <subject>", "Email subject")
    .requiredOption("--body <text>", "Plain-text body")
    .option("--cc <addresses>", "CC recipients")
    .option("--bcc <addresses>", "BCC recipients")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDraftCreate(clientManager, opts.account, opts.to, opts.subject, opts.body, opts.cc, opts.bcc);
    });

  drafts
    .command("update")
    .description("Update an existing draft")
    .requiredOption("--draft-id <id>", "Draft ID")
    .requiredOption("--to <address>", "Recipient email")
    .requiredOption("--subject <subject>", "Email subject")
    .requiredOption("--body <text>", "Plain-text body")
    .option("--cc <addresses>", "CC recipients")
    .option("--bcc <addresses>", "BCC recipients")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDraftUpdate(clientManager, opts.account, opts.draftId, opts.to, opts.subject, opts.body, opts.cc, opts.bcc);
    });

  drafts
    .command("delete")
    .description("Delete a draft")
    .requiredOption("--draft-id <id>", "Draft ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDraftDelete(clientManager, opts.account, opts.draftId);
    });

  drafts
    .command("send")
    .description("Send a draft")
    .requiredOption("--draft-id <id>", "Draft ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDraftSend(clientManager, opts.account, opts.draftId);
    });

  // Labels subcommand group
  const labels = gmail.command("labels").description("Label management");

  labels
    .command("list")
    .description("List all labels")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleLabelsList(clientManager, opts.account);
    });

  labels
    .command("create")
    .description("Create a new label")
    .requiredOption("--name <name>", "Label name")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleLabelCreate(clientManager, opts.account, opts.name);
    });

  labels
    .command("delete")
    .description("Delete a label")
    .requiredOption("--label-id <id>", "Label ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleLabelDelete(clientManager, opts.account, opts.labelId);
    });

  // Threads subcommand group
  const threads = gmail.command("threads").description("Thread management");

  threads
    .command("list")
    .description("List threads")
    .option("--query <query>", "Gmail search query")
    .option("--max-results <n>", "Maximum threads to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleThreadList(clientManager, opts.account, parseInt(opts.maxResults), opts.query);
    });

  threads
    .command("get")
    .description("Get all messages in a thread")
    .requiredOption("--thread-id <id>", "Thread ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleThreadGet(clientManager, opts.account, opts.threadId);
    });
}
