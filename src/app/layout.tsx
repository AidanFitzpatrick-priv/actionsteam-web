import type { Metadata } from "next";
import "./globals.css";
import { AppFrame } from "@/components/AppFrame";
import { PasswordResetGate } from "@/components/PasswordResetGate";

export const metadata: Metadata = {
  title: "Actions Tracker",
  description: "Team actions schedule, tracker, and stats"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <PasswordResetGate>
          <AppFrame>{children}</AppFrame>
        </PasswordResetGate>
      </body>
    </html>
  );
}
