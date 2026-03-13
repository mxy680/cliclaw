export interface IntegrationDef {
  id: string;
  displayName: string;
  scopes: string[];
}

export const INTEGRATIONS: Record<string, IntegrationDef> = {
  gmail: {
    id: "gmail",
    displayName: "Gmail",
    scopes: ["https://www.googleapis.com/auth/gmail.modify"],
  },
  gdrive: {
    id: "gdrive",
    displayName: "Google Drive",
    scopes: ["https://www.googleapis.com/auth/drive"],
  },
  gsheets: {
    id: "gsheets",
    displayName: "Google Sheets",
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  },
  gslides: {
    id: "gslides",
    displayName: "Google Slides",
    scopes: [
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/drive.file",
    ],
  },
  calendar: {
    id: "calendar",
    displayName: "Google Calendar",
    scopes: ["https://www.googleapis.com/auth/calendar"],
  },
  forms: {
    id: "forms",
    displayName: "Google Forms",
    scopes: [
      "https://www.googleapis.com/auth/forms.body",
      "https://www.googleapis.com/auth/forms.responses.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  },
};
