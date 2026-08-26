import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isFullAdmin } from "@/lib/rbac";
import { AdminMonthsClient } from "./AdminMonthsClient";

export default async function AdminMonthsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isFullAdmin(user.role)) redirect("/");

  return (
    <div className="container-wide">
      <h1>Months</h1>
      <AdminMonthsClient />
    </div>
  );
}
