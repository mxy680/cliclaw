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

export async function handleUpdateEvent(
  clientManager: OAuthClientManager,
  account: string,
  calendarId: string,
  eventId: string,
  summary?: string,
  start?: string,
  end?: string,
  description?: string,
  location?: string,
): Promise<void> {
  const tokenKey = `calendar:${account}`;
  try {
    const calendar = getCalendar(clientManager, tokenKey);

    const res = await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: {
        summary: summary ?? undefined,
        start: start ? { dateTime: start } : undefined,
        end: end ? { dateTime: end } : undefined,
        description: description ?? undefined,
        location: location ?? undefined,
      },
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("update_event_failed", err instanceof Error ? err.message : String(err));
  }
}
