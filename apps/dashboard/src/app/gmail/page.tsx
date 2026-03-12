import { google } from "googleapis";
import { getDashboardAuth, getTokenStore } from "@/lib/auth";
import { AccountList } from "@/components/account-list";

export const dynamic = "force-dynamic";

async function getAccounts() {
  const clientManager = getDashboardAuth();
  const names = clientManager.listAccounts();

  return Promise.all(
    names.map(async (name) => {
      try {
        const client = clientManager.getClient(name);
        const gmail = google.gmail({ version: "v1", auth: client });
        const res = await gmail.users.getProfile({ userId: "me" });
        return { name, email: res.data.emailAddress ?? null };
      } catch {
        return { name, email: null };
      }
    }),
  );
}

async function removeAccount(accountName: string): Promise<{ success: boolean }> {
  "use server";
  const tokenStore = getTokenStore();
  tokenStore.delete(accountName);
  return { success: true };
}

export default async function GmailPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const params = await searchParams;
  const accounts = await getAccounts();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Gmail Accounts</h1>
      {params.success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded p-3 mb-4 text-sm">
          Account connected successfully.
        </div>
      )}
      <AccountList accounts={accounts} removeAction={removeAccount} />
    </div>
  );
}
