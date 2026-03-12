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

describe.sequential("Google Forms CLI integration", () => {
  const timestamp = Date.now();

  let formId: string;
  let formTitle: string;

  // ── Accounts ──────────────────────────────────────────────────────

  it("accounts — returns a list with at least the default account", async () => {
    const result = await run("forms", "accounts");
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data).toHaveProperty("accounts");
    expect(Array.isArray(data.accounts)).toBe(true);

    const names = data.accounts.map((a: any) => a.account);
    expect(names).toContain("default");
  });

  // ── Create ────────────────────────────────────────────────────────

  it("create — creates a new form and returns form data", async () => {
    formTitle = `cliclaw-test-${timestamp}`;
    const result = await run(
      "forms", "create",
      "--title", formTitle,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.formId).toBeTruthy();
    expect(data.info).toBeTruthy();
    expect(data.info.title).toBe(formTitle);
    expect(data.responderUri).toBeTruthy();

    formId = data.formId;
  });

  // ── List ──────────────────────────────────────────────────────────

  it("list — returns an array of forms including the one we created", async () => {
    const result = await run("forms", "list", "--max-results", "10");
    expect(result.exitCode).toBe(0);

    const forms = parseJson(result);
    expect(Array.isArray(forms)).toBe(true);
    expect(forms.length).toBeGreaterThan(0);

    const form = forms[0];
    expect(form).toHaveProperty("id");
    expect(form).toHaveProperty("name");
    expect(form).toHaveProperty("createdTime");
    expect(form).toHaveProperty("modifiedTime");

    // Our form should be among the results (it was just created)
    const ids = forms.map((f: any) => f.id);
    expect(ids).toContain(formId);
  });

  // ── Get ───────────────────────────────────────────────────────────

  it("get — returns full form details by ID", async () => {
    const result = await run("forms", "get", "--form-id", formId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.formId).toBe(formId);
    expect(data.info).toBeTruthy();
    expect(data.info.title).toBe(formTitle);
    expect(data.responderUri).toBeTruthy();
    expect(data.revisionId).toBeTruthy();
  });

  // ── Update ────────────────────────────────────────────────────────

  it("update — updates the form title", async () => {
    const newTitle = `cliclaw-updated-${timestamp}`;
    const result = await run(
      "forms", "update",
      "--form-id", formId,
      "--title", newTitle,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);

    // Verify the title was updated
    const getResult = await run("forms", "get", "--form-id", formId);
    const form = parseJson(getResult);
    expect(form.info.title).toBe(newTitle);

    formTitle = newTitle;
  });

  it("update — updates the form description", async () => {
    const description = `Test description ${timestamp}`;
    const result = await run(
      "forms", "update",
      "--form-id", formId,
      "--description", description,
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);

    // Verify the description was updated
    const getResult = await run("forms", "get", "--form-id", formId);
    const form = parseJson(getResult);
    expect(form.info.description).toBe(description);
  });

  // ── Add Questions ─────────────────────────────────────────────────

  it("add-question — adds a text question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "What is your name?",
      "--type", "text",
      "--required",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.replies).toBeTruthy();
    expect(Array.isArray(data.replies)).toBe(true);
  });

  it("add-question — adds a paragraph question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "Tell us about yourself",
      "--type", "paragraph",
      "--index", "1",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("add-question — adds a multiple choice question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "What is your favorite color?",
      "--type", "choice",
      "--options", "Red,Blue,Green,Yellow",
      "--index", "2",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("add-question — adds a checkbox question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "Select your hobbies",
      "--type", "checkbox",
      "--options", "Reading,Gaming,Cooking,Sports",
      "--index", "3",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("add-question — adds a dropdown question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "Select your country",
      "--type", "dropdown",
      "--options", "USA,Canada,UK,Australia,Other",
      "--index", "4",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("add-question — adds a scale question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "Rate your experience (1-5)",
      "--type", "scale",
      "--index", "5",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("add-question — adds a date question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "When is your birthday?",
      "--type", "date",
      "--index", "6",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  it("add-question — adds a time question", async () => {
    const result = await run(
      "forms", "add-question",
      "--form-id", formId,
      "--title", "What time works for you?",
      "--type", "time",
      "--index", "7",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
  });

  // ── List Questions ────────────────────────────────────────────────

  it("questions — lists all questions in the form", async () => {
    const result = await run("forms", "questions", "--form-id", formId);
    expect(result.exitCode).toBe(0);

    const questions = parseJson(result);
    expect(Array.isArray(questions)).toBe(true);
    expect(questions.length).toBe(8);

    // Verify question types
    const types = questions.map((q: any) => q.type);
    expect(types).toContain("text");
    expect(types).toContain("choice");
    expect(types).toContain("scale");
    expect(types).toContain("date");
    expect(types).toContain("time");

    // Verify structure
    const q = questions[0];
    expect(q).toHaveProperty("itemId");
    expect(q).toHaveProperty("title");
    expect(q).toHaveProperty("questionId");
    expect(q).toHaveProperty("type");
    expect(q).toHaveProperty("required");
  });

  // ── Update Question ───────────────────────────────────────────────

  it("update-question — updates a question title", async () => {
    const result = await run(
      "forms", "update-question",
      "--form-id", formId,
      "--item-index", "0",
      "--title", "What is your full name?",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);

    // Verify the update
    const getResult = await run("forms", "questions", "--form-id", formId);
    const questions = parseJson(getResult);
    expect(questions[0].title).toBe("What is your full name?");
  });

  // ── Delete Question ───────────────────────────────────────────────

  it("delete-question — deletes the last question (time)", async () => {
    const result = await run(
      "forms", "delete-question",
      "--form-id", formId,
      "--item-index", "7",
    );
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);

    // Verify it was deleted
    const getResult = await run("forms", "questions", "--form-id", formId);
    const questions = parseJson(getResult);
    expect(questions.length).toBe(7);
  });

  // ── Responses (empty — no submissions yet) ────────────────────────

  it("responses — returns an empty array for a new form", async () => {
    const result = await run("forms", "responses", "--form-id", formId);
    expect(result.exitCode).toBe(0);

    const responses = parseJson(result);
    expect(Array.isArray(responses)).toBe(true);
    expect(responses.length).toBe(0);
  });

  // ── Error Handling ────────────────────────────────────────────────

  it("get — returns error for non-existent form ID", async () => {
    const result = await run("forms", "get", "--form-id", "nonexistent-form-id-12345");
    expect(result.exitCode).not.toBe(0);

    const data = parseJson(result);
    expect(data.error).toBe("get_form_failed");
  });

  it("update — returns error when no fields provided", async () => {
    const result = await run(
      "forms", "update",
      "--form-id", formId,
    );
    expect(result.exitCode).not.toBe(0);

    const data = parseJson(result);
    expect(data.error).toBe("update_form_failed");
  });

  it("delete-question — returns error for out-of-range index", async () => {
    const result = await run(
      "forms", "delete-question",
      "--form-id", formId,
      "--item-index", "999",
    );
    expect(result.exitCode).not.toBe(0);

    const data = parseJson(result);
    expect(data.error).toBe("delete_question_failed");
  });

  it("response — returns error for non-existent response ID", async () => {
    const result = await run(
      "forms", "response",
      "--form-id", formId,
      "--response-id", "nonexistent-response-id",
    );
    expect(result.exitCode).not.toBe(0);

    const data = parseJson(result);
    expect(data.error).toBe("get_response_failed");
  });

  // ── Cleanup ───────────────────────────────────────────────────────
  // Note: Google Forms API does not have a delete endpoint.
  // Forms can only be trashed via the Drive API.
  // We use the gdrive integration to clean up.

  it("cleanup — trashes the test form via Google Drive", async () => {
    const result = await run("gdrive", "trash", "--id", formId);
    expect(result.exitCode).toBe(0);

    const data = parseJson(result);
    expect(data.success).toBe(true);
    expect(data.action).toBe("trash");
  });
});
