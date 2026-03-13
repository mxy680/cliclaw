"use client";

import { createContext, useContext, type ReactNode } from "react";

interface SessionData {
  id: string;
  email: string;
  isAdmin: boolean;
}

const SessionContext = createContext<SessionData | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionData;
  children: ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionData {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
