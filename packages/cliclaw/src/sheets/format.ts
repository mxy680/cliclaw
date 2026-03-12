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

function hexToColor(hex: string): { red: number; green: number; blue: number } {
  const h = hex.replace("#", "");
  return {
    red: parseInt(h.substring(0, 2), 16) / 255,
    green: parseInt(h.substring(2, 4), 16) / 255,
    blue: parseInt(h.substring(4, 6), 16) / 255,
  };
}

function parseA1Range(range: string): { sheetId: number; startRow: number; endRow: number; startCol: number; endCol: number } | null {
  // Simple A1 parser: "Sheet1!A1:D10" or "A1:D10"
  const match = range.match(/^(?:.*!)?([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!match) return null;

  function colToIndex(col: string): number {
    let idx = 0;
    for (let i = 0; i < col.length; i++) {
      idx = idx * 26 + (col.charCodeAt(i) - 64);
    }
    return idx - 1;
  }

  return {
    sheetId: 0, // Default to first sheet; caller may override
    startRow: parseInt(match[2]) - 1,
    endRow: parseInt(match[4]),
    startCol: colToIndex(match[1]),
    endCol: colToIndex(match[3]) + 1,
  };
}

export async function handleFormat(
  clientManager: OAuthClientManager,
  account: string,
  spreadsheetId: string,
  range: string,
  options: { bold?: boolean; bgColor?: string; textColor?: string; sheetId?: number },
): Promise<void> {
  const tokenKey = `gsheets:${account}`;
  try {
    const sheets = getSheets(clientManager, tokenKey);

    const parsed = parseA1Range(range);
    if (!parsed) {
      outputError("format_failed", `Could not parse range: ${range}`);
    }

    if (options.sheetId !== undefined) {
      parsed!.sheetId = options.sheetId;
    }

    const cellFormat: Record<string, unknown> = {};
    const fields: string[] = [];

    if (options.bold !== undefined) {
      cellFormat.textFormat = { bold: options.bold };
      fields.push("userEnteredFormat.textFormat.bold");
    }

    if (options.bgColor) {
      cellFormat.backgroundColor = hexToColor(options.bgColor);
      fields.push("userEnteredFormat.backgroundColor");
    }

    if (options.textColor) {
      if (cellFormat.textFormat) {
        (cellFormat.textFormat as Record<string, unknown>).foregroundColor = hexToColor(options.textColor);
      } else {
        cellFormat.textFormat = { foregroundColor: hexToColor(options.textColor) };
      }
      fields.push("userEnteredFormat.textFormat.foregroundColor");
    }

    if (fields.length === 0) {
      outputError("format_failed", "No formatting options specified");
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: {
              sheetId: parsed!.sheetId,
              startRowIndex: parsed!.startRow,
              endRowIndex: parsed!.endRow,
              startColumnIndex: parsed!.startCol,
              endColumnIndex: parsed!.endCol,
            },
            cell: { userEnteredFormat: cellFormat },
            fields: fields.join(","),
          },
        }],
      },
    });

    outputJson({ success: true, range, formatting: options });
  } catch (err) {
    if ((err as Error).message?.includes("format_failed")) throw err;
    outputError("format_failed", err instanceof Error ? err.message : String(err));
  }
}
