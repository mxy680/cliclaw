import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getForms(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("forms");
  }
  return google.forms({ version: "v1", auth: client });
}

export async function handleCreateForm(
  clientManager: OAuthClientManager,
  account: string,
  title: string,
  documentTitle?: string,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);
    const res = await forms.forms.create({
      requestBody: {
        info: {
          title,
          documentTitle: documentTitle ?? title,
        },
      },
    });
    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("create_form_failed", err instanceof Error ? err.message : String(err));
  }
}
