import { execFile } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { describe, it, expect, afterAll } from "vitest";

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

describe.sequential("Vercel CLI integration", () => {
  const testProjectName = `cliclaw-test-${Date.now()}`;
  let testProjectId: string;
  let testEnvId: string;

  afterAll(async () => {
    if (testProjectId) {
      await run("vercel", "project-delete", "--project", testProjectId);
    }
  });

  it("whoami — returns authenticated user info", async () => {
    const result = await run("vercel", "whoami");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("user");
    expect(data.user).toHaveProperty("email");
  });

  it("projects — returns a list of projects", async () => {
    const result = await run("vercel", "projects", "--max-results", "5");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(Array.isArray(data)).toBe(true);
  });

  it("project-create — creates a test project", async () => {
    const result = await run("vercel", "project-create", "--name", testProjectName);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("id");
    expect(data.name).toBe(testProjectName);

    testProjectId = data.id;
  });

  it("project — gets the test project by ID", async () => {
    const result = await run("vercel", "project", "--project", testProjectId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.id).toBe(testProjectId);
    expect(data.name).toBe(testProjectName);
  });

  it("env-create — creates an env var on the test project", async () => {
    const result = await run(
      "vercel", "env-create",
      "--project", testProjectId,
      "--key", "CLICLAW_TEST_VAR",
      "--value", "test-value",
      "--target", "development,preview",
      "--type", "plain",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("id");
    testEnvId = data.id;
  });

  it("envs — lists env vars for the test project", async () => {
    const result = await run("vercel", "envs", "--project", testProjectId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(Array.isArray(data)).toBe(true);

    const ids = data.map((e: any) => e.id);
    expect(ids).toContain(testEnvId);
  });

  it("env — gets the created env var", async () => {
    const result = await run(
      "vercel", "env",
      "--project", testProjectId,
      "--env-id", testEnvId,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.key).toBe("CLICLAW_TEST_VAR");
  });

  it("env-update — updates the env var value", async () => {
    const result = await run(
      "vercel", "env-update",
      "--project", testProjectId,
      "--env-id", testEnvId,
      "--value", "updated-value",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("id");
  });

  it("env-delete — deletes the env var", async () => {
    const result = await run(
      "vercel", "env-delete",
      "--project", testProjectId,
      "--env-id", testEnvId,
    );
    expect(result.exitCode).toBe(0);
  });

  it("deployments — lists deployments", async () => {
    const result = await run("vercel", "deployments", "--max-results", "5");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(Array.isArray(data)).toBe(true);
  });

  it("domains — lists domains", async () => {
    const result = await run("vercel", "domains", "--max-results", "5");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(Array.isArray(data)).toBe(true);
  });

  it("project-delete — deletes the test project", async () => {
    const result = await run("vercel", "project-delete", "--project", testProjectId);
    expect(result.exitCode).toBe(0);
    testProjectId = ""; // prevent afterAll cleanup
  });
});
