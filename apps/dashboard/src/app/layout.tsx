import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/nav";
import { cn } from "@/lib/utils";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "cliclaw",
  description: "Manage your cliclaw integrations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn(outfit.variable, jetbrains.variable)}>
      <body className="flex min-h-screen font-sans antialiased">
        <Nav />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl px-8 py-10">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
