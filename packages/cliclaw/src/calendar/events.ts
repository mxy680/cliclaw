import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getCalendar(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("calendar");
  }
  return google.calendar({ version: "v3", auth: client });
}

export async function handleEvents(
  clientManager: OAuthClientManager,
  account: string,
  calendarId: string,
  maxResults: number,
  timeMin?: string,
  timeMax?: string,
): Promise<void> {
  const tokenKey = `calendar:${account}`;
  try {
    const calendar = getCalendar(clientManager, tokenKey);
    const res = await calendar.events.list({
      calendarId,
      maxResults,
      singleEvents: true,
      orderBy: "startTime",
      timeMin: timeMin ?? undefined,
      timeMax: timeMax ?? undefined,
    });
    const events = (res.data.items ?? []).map((e: { id?: string | null; summary?: string | null; start?: unknown; end?: unknown; status?: string | null; location?: string | null; htmlLink?: string | null }) => ({
      id: e.id,
      summary: e.summary,
      start: e.start,
      end: e.end,
      status: e.status,
      location: e.location,
      htmlLink: e.htmlLink,
    }));
    outputJson(events);
  } catch (err) {
    outputError("events_failed", err instanceof Error ? err.message : String(err));
  }
}
