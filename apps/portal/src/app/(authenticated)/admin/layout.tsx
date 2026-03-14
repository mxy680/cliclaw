import { redirect } from "next/navigation";
import { getSession, isAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !isAdmin(session.email)) redirect("/agents");
  return <>{children}</>;
}
