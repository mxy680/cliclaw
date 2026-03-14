import { Command } from "commander";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { handleAuth } from "../sheets/auth.js";
import { handleAccounts } from "../sheets/accounts.js";
import { handleList, handleCreate, handleGet, handleDelete } from "../sheets/spreadsheets.js";
import { handleListSheets, handleAddSheet, handleDeleteSheet, handleRenameSheet } from "../sheets/sheets-tab.js";
import { handleRead, handleWrite, handleAppend, handleClear } from "../sheets/cells.js";
import { handleFormat } from "../sheets/format.js";

type ClientFactory = () => { clientManager: OAuthClientManager; port: number };

export function registerSheetsCommands(program: Command, getClient: ClientFactory): void {
  let cached: { clientManager: OAuthClientManager; port: number } | null = null;
  function resolve() {
    if (!cached) cached = getClient();
    return cached;
  }

  const sheets = program.command("sheets").description("Google Sheets commands");

  sheets
    .command("auth")
    .description("Authenticate with Google Sheets via Google OAuth2")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager, port } = resolve();
      await handleAuth(clientManager, port, opts.account);
    });

  sheets
    .command("accounts")
    .description("List authenticated Google Sheets accounts")
    .action(async () => {
      const { clientManager } = resolve();
      await handleAccounts(clientManager);
    });

  // Spreadsheet-level commands
  sheets
    .command("list")
    .description("List spreadsheets in Google Drive")
    .option("--max-results <n>", "Maximum spreadsheets to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleList(clientManager, opts.account, parseInt(opts.maxResults));
    });

  sheets
    .command("create")
    .description("Create a new spreadsheet")
    .requiredOption("--title <title>", "Spreadsheet title")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleCreate(clientManager, opts.account, opts.title);
    });

  sheets
    .command("get")
    .description("Get spreadsheet metadata")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGet(clientManager, opts.account, opts.id);
    });

  sheets
    .command("delete")
    .description("Permanently delete a spreadsheet")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDelete(clientManager, opts.account, opts.id);
    });

  // Sheet/tab-level commands
  sheets
    .command("list-sheets")
    .description("List sheets/tabs in a spreadsheet")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleListSheets(clientManager, opts.account, opts.id);
    });

  sheets
    .command("add-sheet")
    .description("Add a new sheet/tab to a spreadsheet")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--title <title>", "Sheet title")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleAddSheet(clientManager, opts.account, opts.id, opts.title);
    });

  sheets
    .command("delete-sheet")
    .description("Delete a sheet/tab from a spreadsheet")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--sheet-id <sheetId>", "Sheet ID (numeric)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDeleteSheet(clientManager, opts.account, opts.id, parseInt(opts.sheetId));
    });

  sheets
    .command("rename-sheet")
    .description("Rename a sheet/tab in a spreadsheet")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--sheet-id <sheetId>", "Sheet ID (numeric)")
    .requiredOption("--title <title>", "New sheet title")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleRenameSheet(clientManager, opts.account, opts.id, parseInt(opts.sheetId), opts.title);
    });

  // Cell/range-level commands
  sheets
    .command("read")
    .description("Read cell values from a range")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--range <range>", "Cell range (e.g. Sheet1!A1:D10)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleRead(clientManager, opts.account, opts.id, opts.range);
    });

  sheets
    .command("write")
    .description("Write values to a range")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--range <range>", "Cell range (e.g. Sheet1!A1:D10)")
    .requiredOption("--values <json>", "JSON array of arrays (e.g. '[[\"a\",\"b\"],[\"c\",\"d\"]]')")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      const values = JSON.parse(opts.values);
      await handleWrite(clientManager, opts.account, opts.id, opts.range, values);
    });

  sheets
    .command("append")
    .description("Append rows after existing data")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--range <range>", "Cell range to append after")
    .requiredOption("--values <json>", "JSON array of arrays")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      const values = JSON.parse(opts.values);
      await handleAppend(clientManager, opts.account, opts.id, opts.range, values);
    });

  sheets
    .command("clear")
    .description("Clear values in a range")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--range <range>", "Cell range to clear")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleClear(clientManager, opts.account, opts.id, opts.range);
    });

  // Formatting
  sheets
    .command("format")
    .description("Apply formatting to a range")
    .requiredOption("--id <id>", "Spreadsheet ID")
    .requiredOption("--range <range>", "Cell range (e.g. A1:D10)")
    .option("--bold", "Apply bold formatting")
    .option("--bg-color <hex>", "Background color (hex, e.g. #ff0000)")
    .option("--text-color <hex>", "Text color (hex, e.g. #ffffff)")
    .option("--sheet-id <sheetId>", "Sheet ID (numeric, defaults to 0)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleFormat(clientManager, opts.account, opts.id, opts.range, {
        bold: opts.bold,
        bgColor: opts.bgColor,
        textColor: opts.textColor,
        sheetId: opts.sheetId ? parseInt(opts.sheetId) : undefined,
      });
    });
}
