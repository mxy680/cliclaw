import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignInForm } from "@/components/sign-in-form";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

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
        <SignInForm />
      </div>
    </div>
  );
}
