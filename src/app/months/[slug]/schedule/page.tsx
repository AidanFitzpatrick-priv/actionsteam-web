import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getMonthBySlug, listMonths } from "@/services/months";
import { ScheduleClient } from "./ScheduleClient";

type Props = { params: Promise<{ slug: string }> };

export default async function SchedulePage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const month = await getMonthBySlug(slug);
  if (!month || month.archivedAt) notFound();

  const months = await listMonths(false);

  return (
    <div className="container-schedule schedule-layout">
      <ScheduleClient
        slug={slug}
        months={months.map(m => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          year: m.year,
          isActive: m.isActive
        }))}
      />
    </div>
  );
}
