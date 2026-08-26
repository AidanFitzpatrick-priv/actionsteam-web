import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { LeaderboardClient } from "./LeaderboardClient";

export default async function LeaderboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container-wide">
      <LeaderboardClient />
    </div>
  );
}
