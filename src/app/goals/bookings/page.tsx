import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { GoalsClient } from "../GoalsClient";

export default async function BookingGoalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="container-wide">
      <GoalsClient kind="bookings" />
    </div>
  );
}
