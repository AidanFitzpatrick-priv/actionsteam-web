import fs from "node:fs";
import path from "node:path";

export type GuideMeta = {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
};

export type Guide = GuideMeta & {
  content: string;
};

const GUIDES_DIR = path.join(process.cwd(), "content", "guides");

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value;
  }

  return { meta, body: match[2].trim() };
}

function slugFromFilename(filename: string): string {
  return filename.replace(/\.md$/, "");
}

function readGuideMeta(filename: string): GuideMeta {
  const slug = slugFromFilename(filename);
  const raw = fs.readFileSync(path.join(GUIDES_DIR, filename), "utf8");
  const { meta } = parseFrontmatter(raw);

  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? "",
    updatedAt: meta.updatedAt ?? ""
  };
}

export function getAllGuides(): GuideMeta[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];

  return fs
    .readdirSync(GUIDES_DIR)
    .filter(f => f.endsWith(".md"))
    .map(readGuideMeta)
    .sort((a, b) => {
      if (a.updatedAt && b.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      return a.title.localeCompare(b.title);
    });
}

export function getGuideBySlug(slug: string): Guide | null {
  const filePath = path.join(GUIDES_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { meta, body } = parseFrontmatter(raw);

  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? "",
    updatedAt: meta.updatedAt ?? "",
    content: body
  };
}
