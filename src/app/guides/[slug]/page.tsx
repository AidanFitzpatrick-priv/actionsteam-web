import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GuideContent } from "@/components/GuideContent";
import { getAllGuides, getGuideBySlug } from "@/lib/guides";
import { getCurrentUser } from "@/lib/session";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllGuides().map(guide => ({ slug: guide.slug }));
}

export default async function GuidePage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <div className="container-wide">
      <p style={{ margin: "0 0 16px" }}>
        <Link href="/guides" className="muted">← All guides</Link>
      </p>

      <header className="guide-header">
        <h1>{guide.title}</h1>
        {guide.description && <p className="muted">{guide.description}</p>}
        {guide.updatedAt && (
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Last updated {guide.updatedAt}
          </p>
        )}
      </header>

      <article className="card guide-article">
        <GuideContent content={guide.content} />
      </article>
    </div>
  );
}
