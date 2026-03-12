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

export async function handleCreateEvent(
  clientManager: OAuthClientManager,
  account: string,
  calendarId: string,
  summary: string,
  start: string,
  end: string,
  description?: string,
  location?: string,
  attendees?: string[],
): Promise<void> {
  const tokenKey = `calendar:${account}`;
  try {
    const calendar = getCalendar(clientManager, tokenKey);

    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        start: { dateTime: start },
        end: { dateTime: end },
        description: description ?? undefined,
        location: location ?? undefined,
        attendees: attendees && attendees.length > 0 ? attendees.map((email) => ({ email })) : undefined,
      },
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("create_event_failed", err instanceof Error ? err.message : String(err));
  }
}
