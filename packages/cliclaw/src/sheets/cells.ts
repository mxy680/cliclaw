import { google } from "googleapis";
import type { OAuthClientManager } from "@cliclaw/auth";
import { outputJson, outputError, outputAuthRequired } from "../lib/output.js";

function getSheets(clientManager: OAuthClientManager, tokenKey: string) {
  const client = clientManager.getClient(tokenKey);
  if (!client.credentials?.access_token && !client.credentials?.refresh_token) {
    outputAuthRequired("sheets");
  }
  return google.sheets({ version: "v4", auth: client });
}

export async function handleRead(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  range: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    outputJson({
      range: res.data.range,
      values: res.data.values ?? [],
    });
  } catch (err) {
    outputError("read_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleWrite(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  range: string,
  values: string[][],
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    outputJson({
      success: true,
      updatedRange: res.data.updatedRange,
      updatedRows: res.data.updatedRows,
      updatedColumns: res.data.updatedColumns,
      updatedCells: res.data.updatedCells,
    });
  } catch (err) {
    outputError("write_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleAppend(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  range: string,
  values: string[][],
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
    outputJson({
      success: true,
      updatedRange: res.data.updates?.updatedRange,
      updatedRows: res.data.updates?.updatedRows,
      updatedColumns: res.data.updates?.updatedColumns,
      updatedCells: res.data.updates?.updatedCells,
    });
  } catch (err) {
    outputError("append_failed", err instanceof Error ? err.message : String(err));
  }
}

export async function handleClear(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  range: string,
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);
    const res = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
      requestBody: {},
    });
    outputJson({
      success: true,
      clearedRange: res.data.clearedRange,
    });
  } catch (err) {
    outputError("clear_failed", err instanceof Error ? err.message : String(err));
  }
}
