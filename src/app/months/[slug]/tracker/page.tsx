import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMonthBySlug } from "@/services/months";
import { TrackerClient } from "./TrackerClient";

type Props = { params: Promise<{ slug: string }> };

export default async function TrackerPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const month = await getMonthBySlug(slug);
  if (!month || month.archivedAt) notFound();

  return (
    <div className="container-wide">
      <TrackerClient slug={slug} monthName={month.name} />
    </div>
  );
}
