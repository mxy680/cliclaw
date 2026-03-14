import { google } from "googleapis";
import type { OAuthClientManager } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getSheets(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("sheets");
  }
  return google.sheets({ version: "v4", auth: client });
}

function getDrive(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  return google.drive({ version: "v3", auth: client });
}

export async function handleList(
  clientManager: OAuthClientManager,
  account: string,
  maxResults: number,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    const res = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed = false",
      pageSize: maxResults,
      fields: "files(id, name, modifiedTime, webViewLink)",
      orderBy: "modifiedTime desc",
    });
    outputJson(res.data.files ?? []);
  } catch (err) {
    outputError("list_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleCreate(
  clientManager: OAuthClientManager,
  account: string,
  title: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
      },
      fields: "spreadsheetId,spreadsheetUrl,properties",
    });
    outputJson({
      success: true,
      spreadsheetId: res.data.spreadsheetId,
      url: res.data.spreadsheetUrl,
      title: res.data.properties?.title,
    });
  } catch (err) {
    outputError("create_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleGet(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "spreadsheetId,spreadsheetUrl,properties,sheets(properties)",
    });
    outputJson({
      spreadsheetId: res.data.spreadsheetId,
      url: res.data.spreadsheetUrl,
      title: res.data.properties?.title,
      locale: res.data.properties?.locale,
      sheets: res.data.sheets?.map((s) => ({
        sheetId: s.properties?.sheetId,
        title: s.properties?.title,
        index: s.properties?.index,
        rowCount: s.properties?.gridProperties?.rowCount,
        columnCount: s.properties?.gridProperties?.columnCount,
      })),
    });
  } catch (err) {
    outputError("get_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDelete(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const drive = getDrive(clientManager, tokenKey);
    await drive.files.delete({ fileId: spreadsheetId });
    outputJson({ success: true, spreadsheetId });
  } catch (err) {
    outputError("delete_failed", err instanceof Error ? err.message : String(err));
  }
}
