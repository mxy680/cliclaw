"use client";

import { useState } from "react";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to send magic link");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-sm border border-amber/20 bg-card p-6 text-center">
        <p className="font-mono text-sm text-foreground">Check your email</p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">
          We sent a magic link to <span className="text-amber">{email}</span>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={loading}
          className="w-full rounded-sm border border-border bg-card px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:border-amber/50 focus:outline-none focus:ring-1 focus:ring-amber/20 disabled:opacity-50"
        />
      </div>
      {error && (
        <p className="font-mono text-xs text-destructive">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full rounded-sm border border-amber/30 bg-amber/10 px-4 py-3 font-mono text-sm tracking-wider text-amber uppercase hover:bg-amber/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Sending..." : "Send magic link"}
      </button>
    </form>
  );
}
