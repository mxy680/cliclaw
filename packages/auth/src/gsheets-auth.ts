import { readFileSync } from "fs";
import { google } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function createGSheetsOAuthClient(clientSecretPath: string, redirectUri: string): OAuth2Client {
  const secret = JSON.parse(readFileSync(clientSecretPath, "utf-8"));
  const { client_id, client_secret } = secret.installed ?? secret.web;
  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

export function getGSheetsAuthUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
    prompt: "consent",
  });
}
