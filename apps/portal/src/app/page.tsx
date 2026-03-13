import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (session) redirect("/chat");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-mono text-2xl font-bold tracking-tight text-amber">
            cliclaw
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            Sign in to chat with your AI agents
          </p>
        </div>
        {error && (
          <p className="text-center font-mono text-xs text-destructive">
            {error === "auth_denied" ? "Sign-in was cancelled" :
             error === "auth_failed" ? "Authentication failed" :
             "Something went wrong"}
          </p>
        )}
        <SignInForm />
      </div>
    </div>
  );
}
