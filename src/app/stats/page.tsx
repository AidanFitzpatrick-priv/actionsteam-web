import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { StatsClient } from "./StatsClient";

export default async function StatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="container-wide">
      <StatsClient />
    </div>
  );
}
