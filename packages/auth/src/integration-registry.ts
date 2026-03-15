export interface IntegrationDef {
  id: string;
  displayName: string;
  provider: string;
  scopes: string[];
  authType?: "oauth" | "token";
  tokenUrl?: string;
}

export interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  extraScopes: string[];
  extraAuthParams: Record<string, string>;
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  google: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    extraScopes: ["openid", "email", "profile"],
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  github: {
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    clientIdEnv: "GITHUB_CLIENT_ID",
    clientSecretEnv: "GITHUB_CLIENT_SECRET",
    extraScopes: [],
    extraAuthParams: {},
  },
};

export const INTEGRATIONS: Record<string, IntegrationDef> = {
  gmail: {
    id: "gmail",
    displayName: "Gmail",
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/gmail.modify"],
  },
  gdrive: {
    id: "gdrive",
    displayName: "Google Drive",
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/drive"],
  },
  gsheets: {
    id: "gsheets",
    displayName: "Google Sheets",
    provider: "google",
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  },
  gslides: {
    id: "gslides",
    displayName: "Google Slides",
    provider: "google",
    scopes: [
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive.file",
    ],
  },
  calendar: {
    id: "calendar",
    displayName: "Google Calendar",
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/calendar"],
  },
  forms: {
    id: "forms",
    displayName: "Google Forms",
    provider: "google",
    scopes: [
      "https://www.googleapis.com/auth/forms.body",
      "https://www.googleapis.com/auth/forms.responses.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  },
  github: {
    id: "github",
    displayName: "GitHub",
    provider: "github",
    scopes: ["repo", "read:user", "user:email"],
  },
  vercel: {
    id: "vercel",
    displayName: "Vercel",
    provider: "vercel",
    scopes: [],
    authType: "token",
    tokenUrl: "https://vercel.com/account/tokens",
  },
};
