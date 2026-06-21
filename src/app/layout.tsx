import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Actions Tracker",
  description: "Team actions schedule, tracker, and stats"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
