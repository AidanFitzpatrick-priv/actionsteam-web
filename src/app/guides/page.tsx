import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAllGuides } from "@/lib/guides";

export default async function GuidesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const guides = getAllGuides();

  return (
    <div className="container-wide">
      <h1>Guides</h1>
      <p className="muted">How-to guides and reference docs for the team.</p>

      {guides.length === 0 ? (
        <div className="card" style={{ marginTop: 24 }}>
          <p className="muted" style={{ margin: 0 }}>No guides yet.</p>
        </div>
      ) : (
        <ul className="guide-list">
          {guides.map(guide => (
            <li key={guide.slug}>
              <Link href={`/guides/${guide.slug}`} className="guide-card">
                <h2>{guide.title}</h2>
                {guide.description && <p>{guide.description}</p>}
                {guide.updatedAt && (
                  <span className="muted">Updated {guide.updatedAt}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
