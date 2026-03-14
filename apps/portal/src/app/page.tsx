import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SignInForm } from "@/components/auth/sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session) redirect("/agents");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-8">
        <div className="text-center">
          <h1 className="font-mono text-4xl font-bold text-amber">cliclaw</h1>
          <p className="mt-2 text-sm text-muted-foreground">AI Agent Portal</p>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <SignInForm />
      </div>
    </div>
  );
}
