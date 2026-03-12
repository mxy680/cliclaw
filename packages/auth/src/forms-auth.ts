import { readFileSync } from "fs";
import { google } from "googleapis";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export function createFormsOAuthClient(clientSecretPath: string, redirectUri: string): OAuth2Client {
  const secret = JSON.parse(readFileSync(clientSecretPath, "utf-8"));
  const { client_id, client_secret } = secret.installed ?? secret.web;
  return new google.auth.OAuth2(client_id, client_secret, redirectUri);
}

export function getFormsAuthUrl(client: OAuth2Client): string {
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/forms.body",
      "https://www.googleapis.com/auth/forms.responses.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
    prompt: "consent",
  });
}
