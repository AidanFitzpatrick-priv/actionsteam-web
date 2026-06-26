import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { PasswordResetGate } from "@/components/PasswordResetGate";

export const metadata: Metadata = {
  title: "Actions Tracker",
  description: "Team actions schedule, tracker, and stats"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <PasswordResetGate>
          <Nav />
          <main>{children}</main>
        </PasswordResetGate>
      </body>
    </html>
  );
}
