import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isFullAdmin } from "@/lib/rbac";
import { AdminDataClient } from "./AdminDataClient";

export default async function AdminDataPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isFullAdmin(user.role)) redirect("/");

  return (
    <div className="container-wide">
      <h1>Types &amp; gangs</h1>
      <AdminDataClient />
    </div>
  );
}
