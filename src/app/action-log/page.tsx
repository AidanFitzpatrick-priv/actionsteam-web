import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { ActionLogClient } from "./ActionLogClient";

export default async function ActionLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="container-wide">
      <ActionLogClient />
    </div>
  );
}
