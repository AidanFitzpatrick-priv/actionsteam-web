import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMonthBySlug } from "@/services/months";
import { BrTrackerClient } from "./BrTrackerClient";

type Props = { params: Promise<{ slug: string }> };

export default async function BrTrackerPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const month = await getMonthBySlug(slug);
  if (!month || month.archivedAt) notFound();

  return (
    <div className="container-schedule schedule-layout">
      <BrTrackerClient slug={slug} monthName={month.name} monthYear={month.year} />
    </div>
  );
}
