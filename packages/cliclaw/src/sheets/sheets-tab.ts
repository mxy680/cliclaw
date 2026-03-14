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

export async function handleListSheets(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets(properties)",
    });
    const tabList = res.data.sheets?.map((s) => ({
      sheetId: s.properties?.sheetId,
      title: s.properties?.title,
      index: s.properties?.index,
    })) ?? [];
    outputJson(tabList);
  } catch (err) {
    outputError("list_sheets_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleAddSheet(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  title: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
    const reply = res.data.replies?.[0]?.addSheet?.properties;
    outputJson({
      success: true,
      sheetId: reply?.sheetId,
      title: reply?.title,
      index: reply?.index,
    });
  } catch (err) {
    outputError("add_sheet_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleDeleteSheet(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  sheetId: number,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ deleteSheet: { sheetId } }],
      },
    });
    outputJson({ success: true, sheetId });
  } catch (err) {
    outputError("delete_sheet_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleRenameSheet(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  sheetId: number,
  title: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: { sheetId, title },
            fields: "title",
          },
        }],
      },
    });
    outputJson({ success: true, sheetId, title });
  } catch (err) {
    outputError("rename_sheet_failed", err instanceof Error ? err.message : String(err));
  }
}
