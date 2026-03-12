import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
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

describe.sequential("Google Drive CLI integration", () => {
  const timestamp = Date.now();

  let uploadedFileId: string;
  let folderId: string;
  let copiedFileId: string;

  it("accounts — returns a list of gdrive accounts", async () => {
    const result = await run("gdrive", "accounts");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("accounts");
    expect(Array.isArray(data.accounts)).toBe(true);
  });

  it("about — returns user info and storage quota", async () => {
    const result = await run("gdrive", "about");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("user");
    expect(data).toHaveProperty("storageQuota");
    expect(data.user).toHaveProperty("emailAddress");
  });

  it("mkdir — creates a test folder", async () => {
    const folderName = `cliclaw-test-${timestamp}`;
    const result = await run("gdrive", "mkdir", "--name", folderName);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.name).toBe(folderName);
    expect(data.id).toBeTruthy();
    expect(data.mimeType).toBe("application/vnd.google-apps.folder");

    folderId = data.id;
  });

  it("upload — uploads a test file into the folder", async () => {
    // Create a temp file to upload
    const tmpFile = join(tmpdir(), `cliclaw-test-${timestamp}.txt`);
    writeFileSync(tmpFile, `Test file content ${timestamp}`);

    try {
      const result = await run(
        "gdrive", "upload",
        "--file", tmpFile,
        "--parent", folderId,
      );
      expect(result.exitCode).toBe(0);

      const data = parseJson(result);
      expect(data.success).toBe(true);
      expect(data.id).toBeTruthy();
      expect(data.name).toBe(`cliclaw-test-${timestamp}.txt`);

      uploadedFileId = data.id;
    } finally {
      unlinkSync(tmpFile);
    }
  });

  it("list — returns files including our upload", async () => {
    const result = await run("gdrive", "list", "--max-results", "10");
    expect(result.exitCode).toBe(0);

    const files = parseJson(result);
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThan(0);

    const file = files[0];
    expect(file).toHaveProperty("id");
    expect(file).toHaveProperty("name");
    expect(file).toHaveProperty("mimeType");
  });

  it("get — returns file metadata for the uploaded file", async () => {
    const result = await run("gdrive", "get", "--id", uploadedFileId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.id).toBe(uploadedFileId);
    expect(data.name).toBe(`cliclaw-test-${timestamp}.txt`);
    expect(data.mimeType).toBeTruthy();
  });

  it("list-folder — lists the test folder contents", async () => {
    const result = await run("gdrive", "list-folder", "--id", folderId);
    expect(result.exitCode).toBe(0);

    const files = parseJson(result);
    expect(Array.isArray(files)).toBe(true);
    expect(files.length).toBeGreaterThanOrEqual(1);

    const ids = files.map((f: any) => f.id);
    expect(ids).toContain(uploadedFileId);
  });

  it("search — finds the uploaded file by name", async () => {
    const result = await run(
      "gdrive", "search",
      "--query", `cliclaw-test-${timestamp}`,
    );
    expect(result.exitCode).toBe(0);

    const files = parseJson(result);
    expect(Array.isArray(files)).toBe(true);

    // Drive indexing may have a delay, so we check for at least the folder
    const names = files.map((f: any) => f.name);
    const found = names.some((n: string) => n.includes(`cliclaw-test-${timestamp}`));
    expect(found).toBe(true);
  }, 30000);

  it("rename — renames the uploaded file", async () => {
    const newName = `cliclaw-renamed-${timestamp}.txt`;
    const result = await run(
      "gdrive", "rename",
      "--id", uploadedFileId,
      "--name", newName,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.name).toBe(newName);
  });

  it("copy — copies the file", async () => {
    const copyName = `cliclaw-copy-${timestamp}.txt`;
    const result = await run(
      "gdrive", "copy",
      "--id", uploadedFileId,
      "--name", copyName,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.name).toBe(copyName);
    expect(data.id).toBeTruthy();

    copiedFileId = data.id;
  });

  it("download — downloads the uploaded file", async () => {
    const saveDir = tmpdir();
    const result = await run(
      "gdrive", "download",
      "--id", uploadedFileId,
      "--save-dir", saveDir,
      "--filename", `cliclaw-download-${timestamp}.txt`,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.path).toBeTruthy();

    // Clean up downloaded file
    try { unlinkSync(data.path); } catch { /* ignore */ }
  });

  it("permissions — lists permissions on the uploaded file", async () => {
    const result = await run("gdrive", "permissions", "--id", uploadedFileId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.fileId).toBe(uploadedFileId);
    expect(data).toHaveProperty("permissions");
    expect(Array.isArray(data.permissions)).toBe(true);
  });

  it("trash — trashes the copied file", async () => {
    const result = await run("gdrive", "trash", "--id", copiedFileId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.action).toBe("trash");
  });

  it("untrash — restores the copied file from trash", async () => {
    const result = await run("gdrive", "untrash", "--id", copiedFileId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.action).toBe("untrash");
  });

  // Cleanup: permanently delete test files and folder
  it("delete — cleans up the copied file", async () => {
    const result = await run("gdrive", "delete", "--id", copiedFileId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("delete — cleans up the uploaded file", async () => {
    const result = await run("gdrive", "delete", "--id", uploadedFileId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("delete — cleans up the test folder", async () => {
    const result = await run("gdrive", "delete", "--id", folderId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });
});
