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

describe.sequential("Google Slides CLI integration", () => {
  const timestamp = Date.now();

  let presentationId: string;
  let firstSlideId: string;
  let addedSlideId: string;

  it("accounts — returns a list of gslides accounts", async () => {
    const result = await run("gslides", "accounts");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("accounts");
    expect(Array.isArray(data.accounts)).toBe(true);
  });

  it("create — creates a test presentation", async () => {
    const title = `cliclaw-test-${timestamp}`;
    const result = await run("gslides", "create", "--title", title);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.presentationId).toBeTruthy();
    expect(data.title).toBe(title);
    expect(data.slideCount).toBeGreaterThanOrEqual(1);

    presentationId = data.presentationId;
  });

  it("list — returns presentations including our test presentation", async () => {
    const result = await run("gslides", "list", "--max-results", "10");
    expect(result.exitCode).toBe(0);

    const files = parseJson(result);
    expect(Array.isArray(files)).toBe(true);

    const ids = files.map((f: any) => f.id);
    expect(ids).toContain(presentationId);
  });

  it("get — returns presentation details", async () => {
    const result = await run("gslides", "get", "--id", presentationId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.presentationId).toBe(presentationId);
    expect(data.title).toBe(`cliclaw-test-${timestamp}`);
    expect(data.slideCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.slides)).toBe(true);

    firstSlideId = data.slides[0].objectId;
  });

  it("get-slide — returns details of the first slide", async () => {
    const result = await run(
      "gslides", "get-slide",
      "--id", presentationId,
      "--index", "0",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.objectId).toBe(firstSlideId);
    expect(data.index).toBe(0);
  });

  it("add-slide — adds a blank slide", async () => {
    const result = await run(
      "gslides", "add-slide",
      "--id", presentationId,
      "--layout", "BLANK",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.objectId).toBeTruthy();

    addedSlideId = data.objectId;
  });

  it("add-text — adds a text box to the added slide", async () => {
    const result = await run(
      "gslides", "add-text",
      "--id", presentationId,
      "--slide-id", addedSlideId,
      "--text", `Test text ${timestamp}`,
      "--x", "50",
      "--y", "50",
      "--width", "300",
      "--height", "40",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.objectId).toBeTruthy();
  });

  it("add-shape — adds a rectangle shape to the added slide", async () => {
    const result = await run(
      "gslides", "add-shape",
      "--id", presentationId,
      "--slide-id", addedSlideId,
      "--shape", "RECTANGLE",
      "--x", "50",
      "--y", "150",
      "--width", "200",
      "--height", "100",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.objectId).toBeTruthy();
  });

  it("duplicate-slide — duplicates the added slide", async () => {
    const result = await run(
      "gslides", "duplicate-slide",
      "--id", presentationId,
      "--slide-id", addedSlideId,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.originalId).toBe(addedSlideId);
    expect(data.newId).toBeTruthy();
  });

  it("get — confirms presentation now has more slides", async () => {
    const result = await run("gslides", "get", "--id", presentationId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    // Original slide + added slide + duplicated slide = at least 3
    expect(data.slideCount).toBeGreaterThanOrEqual(3);
  });

  it("delete-slide — deletes the added slide", async () => {
    const result = await run(
      "gslides", "delete-slide",
      "--id", presentationId,
      "--slide-id", addedSlideId,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.objectId).toBe(addedSlideId);
  });

  it("delete — permanently deletes the test presentation", async () => {
    const result = await run("gslides", "delete", "--id", presentationId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.presentationId).toBe(presentationId);
  });
});
