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

export async function handleResponses(
  clientManager: OAuthClientManager,
  account: string,
  formId: string,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);
    const res = await forms.forms.responses.list({ formId });
    const responses = (res.data.responses ?? []).map((r) => ({
      responseId: r.responseId,
      createTime: r.createTime,
      lastSubmittedTime: r.lastSubmittedTime,
      respondentEmail: r.respondentEmail,
      totalScore: r.totalScore,
      answers: r.answers,
    }));
    outputJson(responses);
  } catch (err) {
    outputError("responses_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleGetResponse(
  clientManager: OAuthClientManager,
  account: string,
  formId: string,
  responseId: string,
): Promise<void> {
  const tokenKey = `forms:${account}`;
  try {
    const forms = getForms(clientManager, tokenKey);
    const res = await forms.forms.responses.get({ formId, responseId });
    outputJson(res.data);
  } catch (err) {
    outputError("get_response_failed", err instanceof Error ? err.message : String(err));
  }
}
