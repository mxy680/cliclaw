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

export async function handleCalendars(
  clientManager: OAuthClientManager,
  account: string,
): Promise<void> {
  const tokenKey = `calendar:${account}`;
  try {
    const calendar = getCalendar(clientManager, tokenKey);
    const res = await calendar.calendarList.list();
    const calendars = (res.data.items ?? []).map((c) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary ?? false,
      accessRole: c.accessRole,
      backgroundColor: c.backgroundColor,
    }));
    outputJson(calendars);
  } catch (err) {
    outputError("calendars_failed", err instanceof Error ? err.message : String(err));
  }
}
