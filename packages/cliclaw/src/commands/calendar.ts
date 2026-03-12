import { Command } from "commander";
import type { OAuthClientManager } from "@cliclaw/auth";
import { handleAuth } from "../calendar/auth.js";
import { handleAccounts } from "../calendar/accounts.js";
import { handleCalendars } from "../calendar/calendars.js";
import { handleEvents } from "../calendar/events.js";
import { handleGetEvent } from "../calendar/get.js";
import { handleCreateEvent } from "../calendar/create.js";
import { handleUpdateEvent } from "../calendar/update.js";
import { handleDeleteEvent } from "../calendar/delete.js";

type ClientFactory = () => { clientManager: OAuthClientManager; port: number };

export function registerCalendarCommands(program: Command, getClient: ClientFactory): void {
  let cached: { clientManager: OAuthClientManager; port: number } | null = null;
  function resolve() {
    if (!cached) cached = getClient();
    return cached;
  }

  const cal = program.command("calendar").description("Google Calendar commands");

  cal
    .command("auth")
    .description("Authenticate with Google Calendar via Google OAuth2")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager, port } = resolve();
      await handleAuth(clientManager, port, opts.account);
    });

  cal
    .command("accounts")
    .description("List authenticated Google Calendar accounts")
    .action(async () => {
      const { clientManager } = resolve();
      await handleAccounts(clientManager);
    });

  cal
    .command("calendars")
    .description("List available calendars")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleCalendars(clientManager, opts.account);
    });

  cal
    .command("events")
    .description("List events from a calendar")
    .option("--calendar <id>", "Calendar ID", "primary")
    .option("--max-results <n>", "Maximum events to return", "20")
    .option("--time-min <datetime>", "Start of time range (ISO 8601)")
    .option("--time-max <datetime>", "End of time range (ISO 8601)")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleEvents(
        clientManager, opts.account, opts.calendar,
        parseInt(opts.maxResults), opts.timeMin, opts.timeMax,
      );
    });

  cal
    .command("get")
    .description("Get a single event by ID")
    .requiredOption("--event-id <id>", "Event ID")
    .option("--calendar <id>", "Calendar ID", "primary")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleGetEvent(clientManager, opts.account, opts.calendar, opts.eventId);
    });

  cal
    .command("create")
    .description("Create a new calendar event")
    .requiredOption("--summary <text>", "Event title")
    .requiredOption("--start <datetime>", "Start time (ISO 8601)")
    .requiredOption("--end <datetime>", "End time (ISO 8601)")
    .option("--description <text>", "Event description")
    .option("--location <text>", "Event location")
    .option("--attendees <emails>", "Comma-separated attendee emails")
    .option("--calendar <id>", "Calendar ID", "primary")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      const attendees = opts.attendees ? opts.attendees.split(",").map((e: string) => e.trim()) : undefined;
      await handleCreateEvent(
        clientManager, opts.account, opts.calendar,
        opts.summary, opts.start, opts.end,
        opts.description, opts.location, attendees,
      );
    });

  cal
    .command("update")
    .description("Update an existing calendar event")
    .requiredOption("--event-id <id>", "Event ID")
    .option("--summary <text>", "New event title")
    .option("--start <datetime>", "New start time (ISO 8601)")
    .option("--end <datetime>", "New end time (ISO 8601)")
    .option("--description <text>", "New event description")
    .option("--location <text>", "New event location")
    .option("--calendar <id>", "Calendar ID", "primary")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleUpdateEvent(
        clientManager, opts.account, opts.calendar, opts.eventId,
        opts.summary, opts.start, opts.end,
        opts.description, opts.location,
      );
    });

  cal
    .command("delete")
    .description("Delete a calendar event")
    .requiredOption("--event-id <id>", "Event ID")
    .option("--calendar <id>", "Calendar ID", "primary")
    .option("--account <name>", "Account name", "default")
    .action(async (opts) => {
      const { clientManager } = resolve();
      await handleDeleteEvent(clientManager, opts.account, opts.calendar, opts.eventId);
    });
}
