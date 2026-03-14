import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";
import { SessionProvider } from "@/hooks/use-session";
import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  return (
    <SessionProvider
      session={{
        id: session.id,
        email: session.email,
        isAdmin: isAdmin(session.email),
      }}
    >
      <AppShell>
        <ToastProvider>{children}</ToastProvider>
      </AppShell>
    </SessionProvider>
  );
}
