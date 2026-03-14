import { Command } from "commander";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { handleAuth } from "../forms/auth.js";
import { handleAccounts } from "../forms/accounts.js";
import { handleList } from "../forms/list.js";
import { handleGetForm } from "../forms/get.js";
import { handleCreateForm } from "../forms/create.js";
import { handleUpdateForm } from "../forms/update.js";
import { handleQuestions, handleAddQuestion, handleUpdateQuestion, handleDeleteQuestion } from "../forms/questions.js";
import { handleResponses, handleGetResponse } from "../forms/responses.js";

type ClientFactory = () => { clientManager: OAuthClientManager; port: number };

export function registerFormsCommands(program: Command, getClient: ClientFactory): void {
  let cached: { clientManager: OAuthClientManager; port: number } | null = null;
  function resolve() {
    if (!cached) cached = getClient();
    return cached;
  }

  const forms = program.command("forms").description("Google Forms commands");

  forms
    .command("auth")
    .description("Authenticate with Google Forms via Google OAuth2")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager, port } = resolve();
      await handleAuth(clientManager, port, opts.account);
    });

  forms
    .command("accounts")
    .description("List authenticated Google Forms accounts")
    .action(async () => {
      const { clientManager } = resolve();
      await handleAccounts(clientManager);
    });

  forms
    .command("list")
    .description("List all forms")
    .option("--max-results <n>", "Maximum forms to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleList(clientManager, opts.account, parseInt(opts.maxResults));
    });

  forms
    .command("get")
    .description("Get form details by ID")
    .requiredOption("--form-id <id>", "Form ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGetForm(clientManager, opts.account, opts.formId);
    });

  forms
    .command("create")
    .description("Create a new form")
    .requiredOption("--title <text>", "Form title")
    .option("--document-title <text>", "Document title (defaults to form title)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleCreateForm(clientManager, opts.account, opts.title, opts.documentTitle);
    });

  forms
    .command("update")
    .description("Update form metadata")
    .requiredOption("--form-id <id>", "Form ID")
    .option("--title <text>", "New form title")
    .option("--description <text>", "New form description")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleUpdateForm(clientManager, opts.account, opts.formId, opts.title, opts.description);
    });

  forms
    .command("questions")
    .description("List questions in a form")
    .requiredOption("--form-id <id>", "Form ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleQuestions(clientManager, opts.account, opts.formId);
    });

  forms
    .command("add-question")
    .description("Add a question to a form")
    .requiredOption("--form-id <id>", "Form ID")
    .requiredOption("--title <text>", "Question title")
    .option("--type <type>", "Question type: text, paragraph, choice, checkbox, dropdown, scale, date, time", "text")
    .option("--required", "Make question required", false)
    .option("--options <items>", "Comma-separated options (for choice, checkbox, dropdown)")
    .option("--index <n>", "Position index (0-based)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      const options = opts.options ? opts.options.split(",").map((o: string) => o.trim()) : undefined;
      const index = opts.index !== undefined ? parseInt(opts.index) : undefined;
      await handleAddQuestion(clientManager, opts.account, opts.formId, opts.title, opts.type, opts.required, options, index);
    });

  forms
    .command("update-question")
    .description("Update a question in a form")
    .requiredOption("--form-id <id>", "Form ID")
    .requiredOption("--item-index <n>", "Item index (0-based)")
    .option("--title <text>", "New question title")
    .option("--required", "Make question required")
    .option("--no-required", "Make question optional")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleUpdateQuestion(
        clientManager, opts.account, opts.formId,
        parseInt(opts.itemIndex), opts.title, opts.required,
      );
    });

  forms
    .command("delete-question")
    .description("Delete a question from a form")
    .requiredOption("--form-id <id>", "Form ID")
    .requiredOption("--item-index <n>", "Item index (0-based)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDeleteQuestion(clientManager, opts.account, opts.formId, parseInt(opts.itemIndex));
    });

  forms
    .command("responses")
    .description("List all responses for a form")
    .requiredOption("--form-id <id>", "Form ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleResponses(clientManager, opts.account, opts.formId);
    });

  forms
    .command("response")
    .description("Get a single response by ID")
    .requiredOption("--form-id <id>", "Form ID")
    .requiredOption("--response-id <id>", "Response ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGetResponse(clientManager, opts.account, opts.formId, opts.responseId);
    });
}
