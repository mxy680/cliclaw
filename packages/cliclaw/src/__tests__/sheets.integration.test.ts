import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { describe, it, expect } from "vitest";

const execFileAsync = promisify(execFile);
const CLI = join(import.meta.dirname, "../../dist/cli.js");

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function run(...args: string[]): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync("node", [CLI, ...args], {
      timeout: 30000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code ?? 1,
    };
  }
}

function parseJson(result: CliResult): any {
  return JSON.parse(result.stdout);
}

describe.sequential("Google Sheets CLI integration", () => {
  const timestamp = Date.now();

  let spreadsheetId: string;
  let addedSheetId: number;

  it("accounts — returns a list of gsheets accounts", async () => {
    const result = await run("sheets", "accounts");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("accounts");
    expect(Array.isArray(data.accounts)).toBe(true);
  });

  it("create — creates a test spreadsheet", async () => {
    const title = `cliclaw-test-${timestamp}`;
    const result = await run("sheets", "create", "--title", title);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.spreadsheetId).toBeTruthy();
    expect(data.title).toBe(title);

    spreadsheetId = data.spreadsheetId;
  });

  it("list — returns spreadsheets including our test spreadsheet", async () => {
    const result = await run("sheets", "list", "--max-results", "10");
    expect(result.exitCode).toBe(0);

    const files = parseJson(result);
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);

    const ids = files.map((f: any) => f.id);
    expect(ids).toContain(spreadsheetId);
  });

  it("get — returns spreadsheet metadata", async () => {
    const result = await run("sheets", "get", "--id", spreadsheetId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.spreadsheetId).toBe(spreadsheetId);
    expect(data.title).toBe(`cliclaw-test-${timestamp}`);
    expect(Array.isArray(data.sheets)).toBe(true);
    expect(data.sheets.length).toBeGreaterThanOrEqual(1);
  });

  it("list-sheets — lists sheets/tabs in the spreadsheet", async () => {
    const result = await run("sheets", "list-sheets", "--id", spreadsheetId);
    expect(result.exitCode).toBe(0);

    const tabs = parseJson(result);
    expect(Array.isArray(tabs)).toBe(true);
    expect(tabs.length).toBeGreaterThanOrEqual(1);
    expect(tabs[0]).toHaveProperty("sheetId");
    expect(tabs[0]).toHaveProperty("title");
  });

  it("add-sheet — adds a new sheet/tab", async () => {
    const sheetTitle = `TestTab-${timestamp}`;
    const result = await run("sheets", "add-sheet", "--id", spreadsheetId, "--title", sheetTitle);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.title).toBe(sheetTitle);
    expect(data.sheetId).toBeTruthy();

    addedSheetId = data.sheetId;
  });

  it("rename-sheet — renames the added sheet", async () => {
    const newTitle = `RenamedTab-${timestamp}`;
    const result = await run(
      "sheets", "rename-sheet",
      "--id", spreadsheetId,
      "--sheet-id", String(addedSheetId),
      "--title", newTitle,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.title).toBe(newTitle);
  });

  it("write — writes values to cells", async () => {
    const result = await run(
      "sheets", "write",
      "--id", spreadsheetId,
      "--range", "Sheet1!A1:B2",
      "--values", '[["Name","Score"],["Alice","100"]]',
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.updatedCells).toBe(4);
  });

  it("read — reads values back from cells", async () => {
    const result = await run(
      "sheets", "read",
      "--id", spreadsheetId,
      "--range", "Sheet1!A1:B2",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.values).toBeTruthy();
    expect(data.values.length).toBe(2);
    expect(data.values[0]).toEqual(["Name", "Score"]);
    expect(data.values[1]).toEqual(["Alice", "100"]);
  });

  it("append — appends rows after existing data", async () => {
    const result = await run(
      "sheets", "append",
      "--id", spreadsheetId,
      "--range", "Sheet1!A1:B1",
      "--values", '[["Bob","200"]]',
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.updatedRows).toBe(1);
  });

  it("read — confirms appended data appears", async () => {
    const result = await run(
      "sheets", "read",
      "--id", spreadsheetId,
      "--range", "Sheet1!A3:B3",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.values).toBeTruthy();
    expect(data.values[0]).toEqual(["Bob", "200"]);
  });

  it("clear — clears a range of cells", async () => {
    const result = await run(
      "sheets", "clear",
      "--id", spreadsheetId,
      "--range", "Sheet1!A1:B3",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("format — applies bold formatting to a range", async () => {
    // Write some data first
    await run(
      "sheets", "write",
      "--id", spreadsheetId,
      "--range", "Sheet1!A1",
      "--values", '[["Header"]]',
    );

    const result = await run(
      "sheets", "format",
      "--id", spreadsheetId,
      "--range", "A1:A1",
      "--bold",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("delete-sheet — deletes the added sheet", async () => {
    const result = await run(
      "sheets", "delete-sheet",
      "--id", spreadsheetId,
      "--sheet-id", String(addedSheetId),
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.sheetId).toBe(addedSheetId);
  });

  it("delete — permanently deletes the test spreadsheet", async () => {
    const result = await run("sheets", "delete", "--id", spreadsheetId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.spreadsheetId).toBe(spreadsheetId);
  });
});
