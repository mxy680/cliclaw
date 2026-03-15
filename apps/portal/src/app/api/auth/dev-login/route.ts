import { NextResponse } from "next/server";
import { findOrCreateUser, createSession } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/session";
import { getStmts } from "@/lib/db-statements";
import { generateId } from "@/lib/db";
import { AgentStore } from "@digitalpresence/cliclaw-auth";
import { AGENTS_DIR } from "@/lib/constants";

const DEV_EMAIL = "dev@localhost";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not available" }, { status: 404 });
  }

  const user = await findOrCreateUser(DEV_EMAIL);
  const token = await createSession(user.id);

  // Auto-grant access to all agents
  const store = new AgentStore(AGENTS_DIR);
  const agents = store.list();
  const stmts = getStmts();
  for (const agent of agents) {
    await stmts.grantAccess.run(generateId(), user.id, agent.name, user.id);
  }

  const response = NextResponse.redirect(new URL("/agents", process.env.BASE_URL || "http://localhost:3000"));
  response.cookies.set(sessionCookieOptions(token));
  return response;
}
