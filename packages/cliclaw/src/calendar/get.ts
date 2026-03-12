import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getCalendar(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("calendar");
  }
  return google.calendar({ version: "v3", auth: client });
}

export async function handleGetEvent(
  clientManager: OAuthClientManager,
  account: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const tokenKey = `calendar:${account}`;
  try {
    const calendar = getCalendar(clientManager, tokenKey);
    const res = await calendar.events.get({ calendarId, eventId });
    outputJson(res.data);
  } catch (err) {
    outputError("get_event_failed", err instanceof Error ? err.message : String(err));
  }
}
