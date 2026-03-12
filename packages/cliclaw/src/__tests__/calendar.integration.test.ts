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

describe.sequential("Google Calendar CLI integration", () => {
  const timestamp = Date.now();

  let eventId: string;

  // Create event times: 1 hour from now
  const startTime = new Date(Date.now() + 3600000).toISOString();
  const endTime = new Date(Date.now() + 7200000).toISOString();

  it("accounts — returns a list of calendar accounts", async () => {
    const result = await run("calendar", "accounts");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("accounts");
    expect(Array.isArray(data.accounts)).toBe(true);
  });

  // The "calendars" command requires calendar.readonly or full calendar scope,
  // but our auth only grants calendar.events — so this is expected to fail.
  it("calendars — returns insufficient permission (scope limited to events)", async () => {
    const result = await run("calendar", "calendars");
    expect(result.exitCode).toBe(1);

    const data = parseJson(result);
    expect(data.error).toBe("calendars_failed");
  });

  it("create — creates a test event", async () => {
    const summary = `cliclaw-test-${timestamp}`;
    const result = await run(
      "calendar", "create",
      "--summary", summary,
      "--start", startTime,
      "--end", endTime,
      "--description", "Integration test event",
      "--location", "Test Location",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.id).toBeTruthy();
    expect(data.summary).toBe(summary);

    eventId = data.id;
  });

  it("events — lists events including the created one", async () => {
    const result = await run(
      "calendar", "events",
      "--max-results", "10",
      "--time-min", new Date().toISOString(),
    );
    expect(result.exitCode).toBe(0);

    const events = parseJson(result);
    expect(Array.isArray(events)).toBe(true);

    const ids = events.map((e: any) => e.id);
    expect(ids).toContain(eventId);
  });

  it("get — returns the created event details", async () => {
    const result = await run(
      "calendar", "get",
      "--event-id", eventId,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.id).toBe(eventId);
    expect(data.summary).toBe(`cliclaw-test-${timestamp}`);
    expect(data.description).toBe("Integration test event");
    expect(data.location).toBe("Test Location");
  });

  it("update — updates the event summary and description", async () => {
    const newSummary = `cliclaw-updated-${timestamp}`;
    const result = await run(
      "calendar", "update",
      "--event-id", eventId,
      "--summary", newSummary,
      "--description", "Updated description",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.summary).toBe(newSummary);
  });

  it("get — confirms the update was applied", async () => {
    const result = await run(
      "calendar", "get",
      "--event-id", eventId,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.summary).toBe(`cliclaw-updated-${timestamp}`);
    expect(data.description).toBe("Updated description");
  });

  it("delete — deletes the test event", async () => {
    const result = await run(
      "calendar", "delete",
      "--event-id", eventId,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.eventId).toBe(eventId);
  });
});
