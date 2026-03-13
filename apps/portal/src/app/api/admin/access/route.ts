import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function isAdmin(): Promise<boolean> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user?.email && ADMIN_EMAILS.includes(user.email);
}

// Grant access
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const { email, agentName } = await request.json();
  if (!email || !agentName) {
    return new Response(JSON.stringify({ error: "Missing email or agentName" }), { status: 400 });
  }

  const service = getServiceClient();

  // Find or invite user
  const { data: users } = await service.auth.admin.listUsers();
  let userId = users?.users?.find((u) => u.email === email)?.id;

  if (!userId) {
    // Invite the user
    const { data: invited, error } = await service.auth.admin.inviteUserByEmail(email);
    if (error || !invited?.user) {
      return new Response(JSON.stringify({ error: error?.message ?? "Failed to invite user" }), { status: 500 });
    }
    userId = invited.user.id;
  }

  // Grant access
  const { error: insertError } = await service
    .from("client_agent_access")
    .upsert({
      user_id: userId,
      agent_name: agentName,
      granted_by: (await (await createServerClient()).auth.getUser()).data.user?.email ?? "admin",
    }, {
      onConflict: "user_id,agent_name",
    });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 });
  }

  return Response.json({ ok: true });
}

// Revoke access
export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  const { userId, agentName } = await request.json();
  if (!userId || !agentName) {
    return new Response(JSON.stringify({ error: "Missing userId or agentName" }), { status: 400 });
  }

  const service = getServiceClient();
  const { error } = await service
    .from("client_agent_access")
    .delete()
    .eq("user_id", userId)
    .eq("agent_name", agentName);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return Response.json({ ok: true });
}
