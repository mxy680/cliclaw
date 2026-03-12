import { google } from "googleapis";
import { getDashboardAuth, getTokenStore } from "@/lib/auth";
import { CalendarAccountList } from "@/components/calendar-account-list";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

async function getAccounts() {
  const clientManager = getDashboardAuth();
  const allNames = clientManager.listAccounts();
  const calendarNames = allNames.filter((n) => n.startsWith("calendar:"));

  return Promise.all(
    calendarNames.map(async (tokenKey) => {
      const name = tokenKey.replace("calendar:", "");
      try {
        const client = clientManager.getClient(tokenKey);
        const calendar = google.calendar({ version: "v3", auth: client });
        const res = await calendar.calendarList.list({ maxResults: 1 });
        const primary = res.data.items?.find((c) => c.primary);
        return { name, email: primary?.id ?? null };
      } catch {
        return { name, email: null };
      }
    }),
  );
}

async function removeAccount(accountName: string): Promise<{ success: boolean }> {
  "use server";
  const tokenStore = getTokenStore();
  tokenStore.delete(`calendar:${accountName}`);
  return { success: true };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const accounts = await getAccounts();

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-light tracking-wide text-foreground">
            Google Calendar
          </h1>
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider mt-1">
            / ACCOUNTS
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage authenticated Google Calendar accounts. Shared with the CLI.
        </p>
      </div>

      <Separator className="bg-border mb-8" />

      {/* Status banners */}
      {params.success && (
        <div className="flex items-center gap-3 border border-emerald-500/30 bg-emerald-500/5 rounded-sm px-4 py-3 mb-6 animate-fade-in-up">
          <div className="size-1.5 rounded-full bg-emerald-500" />
          <span className="font-mono text-xs text-emerald-400 tracking-wider uppercase">
            Account connected successfully
          </span>
        </div>
      )}

      {params.error && (
        <div className="flex items-center gap-3 border border-destructive/30 bg-destructive/5 rounded-sm px-4 py-3 mb-6 animate-fade-in-up">
          <div className="size-1.5 rounded-full bg-destructive" />
          <span className="font-mono text-xs text-destructive tracking-wider">
            Authentication failed: {params.error}
          </span>
        </div>
      )}

      <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <CalendarAccountList accounts={accounts} removeAction={removeAccount} />
      </div>
    </div>
  );
}
