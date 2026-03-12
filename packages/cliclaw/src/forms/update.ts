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

export async function handleUpdateForm(
  clientManager: OAuthClientManager,
  account: string,
  formId: string,
  title?: string,
  description?: string,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);

    const requests: Array<Record<string, unknown>> = [];

    if (title) {
      requests.push({
        updateFormInfo: {
          info: { title },
          updateMask: "title",
        },
      });
    }

    if (description) {
      requests.push({
        updateFormInfo: {
          info: { description },
          updateMask: "description",
        },
      });
    }

    if (requests.length === 0) {
      outputError("update_form_failed", "No fields to update. Provide --title or --description.");
    }

    const res = await forms.forms.batchUpdate({
      formId,
      requestBody: { requests },
    });

    outputJson({ success: true, ...res.data });
  } catch (err) {
    outputError("update_form_failed", err instanceof Error ? err.message : String(err));
  }
}
