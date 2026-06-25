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
      <h1>Action types &amp; reference data</h1>
      <p className="muted">Manage action types, gangs, and staff names used in schedule and tracker dropdowns.</p>
      <AdminDataClient />
    </div>
  );
}
