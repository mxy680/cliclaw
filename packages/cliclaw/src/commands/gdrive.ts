import { Command } from "commander";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { handleAuth } from "../gdrive/auth.js";
import { handleAccounts } from "../gdrive/accounts.js";
import {
  handleList, handleGet, handleDownload, handleUpload,
  handleDelete, handleTrash, handleUntrash,
  handleMove, handleCopy, handleRename,
} from "../gdrive/files.js";
import { handleMkdir, handleListFolder } from "../gdrive/folders.js";
import { handleSearch } from "../gdrive/search.js";
import { handleShare, handleUnshare, handlePermissions } from "../gdrive/sharing.js";
import { handleAbout } from "../gdrive/about.js";

type ClientFactory = () => { clientManager: OAuthClientManager; port: number };

export function registerGDriveCommands(program: Command, getClient: ClientFactory): void {
  let cached: { clientManager: OAuthClientManager; port: number } | null = null;
  function resolve() {
    if (!cached) cached = getClient();
    return cached;
  }

  const gdrive = program.command("gdrive").description("Google Drive commands");

  gdrive
    .command("auth")
    .description("Authenticate with Google Drive via Google OAuth2")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager, port } = resolve();
      await handleAuth(clientManager, port, opts.account);
    });

  gdrive
    .command("accounts")
    .description("List authenticated Google Drive accounts")
    .action(async () => {
      const { clientManager } = resolve();
      await handleAccounts(clientManager);
    });

  gdrive
    .command("list")
    .description("List files in Google Drive")
    .option("--max-results <n>", "Maximum files to return", "20")
    .option("--query <query>", "Drive query filter (e.g. mimeType='application/pdf')")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleList(clientManager, opts.account, parseInt(opts.maxResults), opts.query);
    });

  gdrive
    .command("get")
    .description("Get file metadata by ID")
    .requiredOption("--id <id>", "File ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGet(clientManager, opts.account, opts.id);
    });

  gdrive
    .command("download")
    .description("Download a file")
    .requiredOption("--id <id>", "File ID")
    .requiredOption("--save-dir <dir>", "Directory to save to")
    .option("--filename <name>", "Override filename")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDownload(clientManager, opts.account, opts.id, opts.saveDir, opts.filename);
    });

  gdrive
    .command("upload")
    .description("Upload a file")
    .requiredOption("--file <path>", "Local file path")
    .option("--name <name>", "Override filename in Drive")
    .option("--parent <id>", "Parent folder ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleUpload(clientManager, opts.account, opts.file, opts.name, opts.parent);
    });

  gdrive
    .command("delete")
    .description("Permanently delete a file")
    .requiredOption("--id <id>", "File ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDelete(clientManager, opts.account, opts.id);
    });

  gdrive
    .command("trash")
    .description("Move a file to trash")
    .requiredOption("--id <id>", "File ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleTrash(clientManager, opts.account, opts.id);
    });

  gdrive
    .command("untrash")
    .description("Restore a file from trash")
    .requiredOption("--id <id>", "File ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleUntrash(clientManager, opts.account, opts.id);
    });

  gdrive
    .command("move")
    .description("Move a file to a different folder")
    .requiredOption("--id <id>", "File ID")
    .requiredOption("--to <folder-id>", "Destination folder ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleMove(clientManager, opts.account, opts.id, opts.to);
    });

  gdrive
    .command("copy")
    .description("Copy a file")
    .requiredOption("--id <id>", "File ID")
    .option("--name <name>", "Name for the copy")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleCopy(clientManager, opts.account, opts.id, opts.name);
    });

  gdrive
    .command("rename")
    .description("Rename a file")
    .requiredOption("--id <id>", "File ID")
    .requiredOption("--name <name>", "New name")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleRename(clientManager, opts.account, opts.id, opts.name);
    });

  gdrive
    .command("mkdir")
    .description("Create a new folder")
    .requiredOption("--name <name>", "Folder name")
    .option("--parent <id>", "Parent folder ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleMkdir(clientManager, opts.account, opts.name, opts.parent);
    });

  gdrive
    .command("list-folder")
    .description("List contents of a specific folder")
    .requiredOption("--id <id>", "Folder ID")
    .option("--max-results <n>", "Maximum items to return", "50")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleListFolder(clientManager, opts.account, opts.id, parseInt(opts.maxResults));
    });

  gdrive
    .command("search")
    .description("Full-text search across Drive")
    .requiredOption("--query <query>", "Search query")
    .option("--max-results <n>", "Maximum results to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleSearch(clientManager, opts.account, opts.query, parseInt(opts.maxResults));
    });

  gdrive
    .command("share")
    .description("Share a file with a user")
    .requiredOption("--id <id>", "File ID")
    .requiredOption("--email <email>", "Email to share with")
    .option("--role <role>", "Permission role: reader, writer, commenter", "reader")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleShare(clientManager, opts.account, opts.id, opts.email, opts.role);
    });

  gdrive
    .command("unshare")
    .description("Remove a permission from a file")
    .requiredOption("--id <id>", "File ID")
    .requiredOption("--permission-id <pid>", "Permission ID to remove")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleUnshare(clientManager, opts.account, opts.id, opts.permissionId);
    });

  gdrive
    .command("permissions")
    .description("List permissions on a file")
    .requiredOption("--id <id>", "File ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handlePermissions(clientManager, opts.account, opts.id);
    });

  gdrive
    .command("about")
    .description("Show storage quota and user info")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleAbout(clientManager, opts.account);
    });
}
