import { Command } from "commander";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { handleAuth } from "../gslides/auth.js";
import { handleAccounts } from "../gslides/accounts.js";
import {
  handleList, handleGet, handleCreate, handleDelete,
  handleGetSlide, handleAddSlide, handleDeleteSlide,
  handleAddText, handleAddImage, handleAddShape, handleDuplicateSlide,
} from "../gslides/presentations.js";

type ClientFactory = () => { clientManager: OAuthClientManager; port: number };

export function registerGSlidesCommands(program: Command, getClient: ClientFactory): void {
  let cached: { clientManager: OAuthClientManager; port: number } | null = null;
  function resolve() {
    if (!cached) cached = getClient();
    return cached;
  }

  const gslides = program.command("gslides").description("Google Slides commands");

  gslides
    .command("auth")
    .description("Authenticate with Google Slides via Google OAuth2")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager, port } = resolve();
      await handleAuth(clientManager, port, opts.account);
    });

  gslides
    .command("accounts")
    .description("List authenticated Google Slides accounts")
    .action(async () => {
      const { clientManager } = resolve();
      await handleAccounts(clientManager);
    });

  gslides
    .command("list")
    .description("List presentations in Google Drive")
    .option("--max-results <n>", "Maximum presentations to return", "20")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleList(clientManager, opts.account, parseInt(opts.maxResults));
    });

  gslides
    .command("get")
    .description("Get presentation details")
    .requiredOption("--id <id>", "Presentation ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGet(clientManager, opts.account, opts.id);
    });

  gslides
    .command("create")
    .description("Create a new presentation")
    .requiredOption("--title <title>", "Presentation title")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleCreate(clientManager, opts.account, opts.title);
    });

  gslides
    .command("delete")
    .description("Permanently delete a presentation")
    .requiredOption("--id <id>", "Presentation ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDelete(clientManager, opts.account, opts.id);
    });

  gslides
    .command("get-slide")
    .description("Get details of a specific slide by index")
    .requiredOption("--id <id>", "Presentation ID")
    .requiredOption("--index <n>", "Slide index (0-based)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGetSlide(clientManager, opts.account, opts.id, parseInt(opts.index));
    });

  gslides
    .command("add-slide")
    .description("Add a new slide to a presentation")
    .requiredOption("--id <id>", "Presentation ID")
    .option("--layout <layout>", "Predefined layout (e.g. BLANK, TITLE, TITLE_AND_BODY)")
    .option("--at <n>", "Insertion index (0-based)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleAddSlide(clientManager, opts.account, opts.id, opts.layout, opts.at !== undefined ? parseInt(opts.at) : undefined);
    });

  gslides
    .command("delete-slide")
    .description("Delete a slide from a presentation")
    .requiredOption("--id <id>", "Presentation ID")
    .requiredOption("--slide-id <slideId>", "Slide object ID")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDeleteSlide(clientManager, opts.account, opts.id, opts.slideId);
    });

  gslides
    .command("add-text")
    .description("Add a text box to a slide")
    .requiredOption("--id <id>", "Presentation ID")
    .requiredOption("--slide-id <slideId>", "Slide object ID")
    .requiredOption("--text <text>", "Text content")
    .option("--x <n>", "X position in points", "100")
    .option("--y <n>", "Y position in points", "100")
    .option("--width <n>", "Width in points", "400")
    .option("--height <n>", "Height in points", "50")
    .option("--font-size <n>", "Font size in points")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleAddText(clientManager, opts.account, opts.id, opts.slideId, opts.text, {
        x: parseFloat(opts.x),
        y: parseFloat(opts.y),
        width: parseFloat(opts.width),
        height: parseFloat(opts.height),
        fontSize: opts.fontSize ? parseFloat(opts.fontSize) : undefined,
      });
    });

  gslides
    .command("add-image")
    .description("Add an image to a slide from a URL")
    .requiredOption("--id <id>", "Presentation ID")
    .requiredOption("--slide-id <slideId>", "Slide object ID")
    .requiredOption("--url <url>", "Image URL")
    .option("--x <n>", "X position in points", "100")
    .option("--y <n>", "Y position in points", "100")
    .option("--width <n>", "Width in points", "300")
    .option("--height <n>", "Height in points", "200")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleAddImage(clientManager, opts.account, opts.id, opts.slideId, opts.url, {
        x: parseFloat(opts.x),
        y: parseFloat(opts.y),
        width: parseFloat(opts.width),
        height: parseFloat(opts.height),
      });
    });

  gslides
    .command("add-shape")
    .description("Add a shape to a slide")
    .requiredOption("--id <id>", "Presentation ID")
    .requiredOption("--slide-id <slideId>", "Slide object ID")
    .requiredOption("--shape <type>", "Shape type (e.g. RECTANGLE, ELLIPSE, STAR_5)")
    .option("--x <n>", "X position in points", "100")
    .option("--y <n>", "Y position in points", "100")
    .option("--width <n>", "Width in points", "200")
    .option("--height <n>", "Height in points", "200")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleAddShape(clientManager, opts.account, opts.id, opts.slideId, opts.shape, {
        x: parseFloat(opts.x),
        y: parseFloat(opts.y),
        width: parseFloat(opts.width),
        height: parseFloat(opts.height),
      });
    });

  gslides
    .command("duplicate-slide")
    .description("Duplicate a slide")
    .requiredOption("--id <id>", "Presentation ID")
    .requiredOption("--slide-id <slideId>", "Slide object ID to duplicate")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDuplicateSlide(clientManager, opts.account, opts.id, opts.slideId);
    });
}
