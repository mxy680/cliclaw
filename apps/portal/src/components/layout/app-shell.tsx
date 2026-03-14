import { NavSidebar } from "./nav-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <main className="flex-1 flex flex-col min-h-0 lg:ml-60">{children}</main>
    </div>
  );
}
