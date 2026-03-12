import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { describe, it, expect, beforeAll } from "vitest";

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

describe.sequential("Gmail CLI integration", () => {
  const timestamp = Date.now();

  let sentMessageId: string;
  let sentThreadId: string;
  let draftId: string;

  it("accounts — returns a list with at least the default account", async () => {
    const result = await run("gmail", "accounts");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("accounts");
    expect(Array.isArray(data.accounts)).toBe(true);

    const names = data.accounts.map((a: any) => a.account);
    expect(names).toContain("default");
  });

  it("labels list — returns an array containing INBOX, SENT, etc.", async () => {
    const result = await run("gmail", "labels", "list");
    expect(result.exitCode).toBe(0);

    const labels = parseJson(result);
    expect(Array.isArray(labels)).toBe(true);

    const labelNames = labels.map((l: any) => l.name);
    expect(labelNames).toContain("INBOX");
    expect(labelNames).toContain("SENT");
  });

  it("label create + delete — creates a label and then deletes it by returned ID", async () => {
    const labelName = `cliclaw-test-${timestamp}`;

    const createResult = await run("gmail", "labels", "create", "--name", labelName);
    expect(createResult.exitCode).toBe(0);

    const created = parseJson(createResult);
    expect(created.success).toBe(true);
    expect(created.name).toBe(labelName);
    expect(created.id).toBeTruthy();

    const deleteResult = await run("gmail", "labels", "delete", "--label-id", created.id);
    expect(deleteResult.exitCode).toBe(0);

    const deleted = parseJson(deleteResult);
    expect(deleted.success).toBe(true);
    expect(deleted.label_id).toBe(created.id);
  });

  it("send — sends a message and returns a message ID", async () => {
    const subject = `cliclaw integration test ${timestamp}`;
    const result = await run(
      "gmail",
      "send",
      "--to",
      "omniclaw680@gmail.com",
      "--subject",
      subject,
      "--body",
      "Test body",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();
    expect(data.threadId).toBeTruthy();

    sentMessageId = data.id;
    sentThreadId = data.threadId;
  });

  it("inbox — returns an array of messages", async () => {
    const result = await run("gmail", "inbox", "--max-results", "5");
    expect(result.exitCode).toBe(0);

    const messages = parseJson(result);
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.length).toBeLessThanOrEqual(5);

    const msg = messages[0];
    expect(msg).toHaveProperty("id");
    expect(msg).toHaveProperty("subject");
    expect(msg).toHaveProperty("from");
    expect(msg).toHaveProperty("date");
  });

  it("search — finds the message we sent (with retry for Gmail indexing delay)", async () => {
    const subject = `cliclaw integration test ${timestamp}`;
    const query = `subject:"cliclaw integration test ${timestamp}"`;

    let messages: any[] = [];
    const maxAttempts = 6;
    const delayMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await run("gmail", "search", "--query", query);
      expect(result.exitCode).toBe(0);

      messages = parseJson(result);
      if (messages.length > 0) break;

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    expect(messages.length).toBeGreaterThan(0);
    const found = messages.some((m: any) =>
      (m.subject as string).includes(`cliclaw integration test ${timestamp}`),
    );
    expect(found).toBe(true);
  }, 60000);

  it("get — returns full message with body_text containing 'Test body'", async () => {
    const result = await run("gmail", "get", "--id", sentMessageId);
    expect(result.exitCode).toBe(0);

    const message = parseJson(result);
    expect(message.id).toBe(sentMessageId);
    expect(message.threadId).toBe(sentThreadId);
    expect(message.body_text).toContain("Test body");
  });

  it("reply — replies to the sent message and returns success", async () => {
    const result = await run("gmail", "reply", "--id", sentMessageId, "--body", "Test reply");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();
    expect(data.threadId).toBe(sentThreadId);
  });

  it("modify — marks the sent message as read", async () => {
    const result = await run("gmail", "modify", "--id", sentMessageId, "--action", "mark_read");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBe(sentMessageId);
    expect(data.action).toBe("mark_read");
  });

  it("threads list — returns an array of threads", async () => {
    const result = await run("gmail", "threads", "list", "--max-results", "5");
    expect(result.exitCode).toBe(0);

    const threads = parseJson(result);
    expect(Array.isArray(threads)).toBe(true);
    expect(threads.length).toBeGreaterThan(0);
    expect(threads.length).toBeLessThanOrEqual(5);

    const thread = threads[0];
    expect(thread).toHaveProperty("id");
    expect(thread).toHaveProperty("snippet");
  });

  it("threads get — returns messages in the thread including our sent message and reply", async () => {
    const result = await run("gmail", "threads", "get", "--thread-id", sentThreadId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.id).toBe(sentThreadId);
    expect(Array.isArray(data.messages)).toBe(true);
    expect(data.messages.length).toBeGreaterThanOrEqual(2);

    const messageIds = data.messages.map((m: any) => m.id);
    expect(messageIds).toContain(sentMessageId);
  });

  it("drafts create — creates a draft and returns a draft ID", async () => {
    const result = await run(
      "gmail",
      "drafts",
      "create",
      "--to",
      "omniclaw680@gmail.com",
      "--subject",
      `cliclaw draft test ${timestamp}`,
      "--body",
      "Draft body",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();

    draftId = data.id;
  });

  it("drafts list — lists drafts and the created draft appears", async () => {
    const result = await run("gmail", "drafts", "list");
    expect(result.exitCode).toBe(0);

    const drafts = parseJson(result);
    expect(Array.isArray(drafts)).toBe(true);

    const draftIds = drafts.map((d: any) => d.id);
    expect(draftIds).toContain(draftId);
  });

  it("drafts update — updates the draft with a new subject", async () => {
    const result = await run(
      "gmail",
      "drafts",
      "update",
      "--draft-id",
      draftId,
      "--to",
      "omniclaw680@gmail.com",
      "--subject",
      `cliclaw draft updated ${timestamp}`,
      "--body",
      "Updated draft body",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();
  });

  it("drafts delete — deletes the draft", async () => {
    const result = await run("gmail", "drafts", "delete", "--draft-id", draftId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.draft_id).toBe(draftId);
  });

  it("forward — forwards the sent message to omniclaw680@gmail.com", async () => {
    const result = await run(
      "gmail",
      "forward",
      "--id",
      sentMessageId,
      "--to",
      "omniclaw680@gmail.com",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();
  });

  it("modify trash — trashes the sent message to clean up", async () => {
    const result = await run("gmail", "modify", "--id", sentMessageId, "--action", "trash");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBe(sentMessageId);
    expect(data.action).toBe("trash");
  });
});
