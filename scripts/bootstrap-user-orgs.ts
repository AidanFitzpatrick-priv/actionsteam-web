import { PrismaClient, UserOrg } from "@prisma/client";

const prisma = new PrismaClient();

/** Initial org assignments by username (case-insensitive). Idempotent: only fills null orgs. */
const ORG_BY_USERNAME: Record<string, UserOrg> = {
  gemini: "gang",
  sillylilly: "gang",
  aurora: "gang",
  jacobb: "gang",
  jude: "gang",
  lytta: "gang",
  noah: "gang",
  sara: "gang",
  unfazedpov: "gang",
  danny: "pd",
  cody: "pd",
  kade: "pd",
  keeley: "pd",
  craigburns2402: "pd",
  jay: "pd",
  lennoc: "pd",
  nemzzzz: "pd",
  tjj: "pd"
};

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, org: true }
  });

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    const desired = ORG_BY_USERNAME[user.username.toLowerCase()];
    if (!desired) continue;
    if (user.org === desired) {
      skipped += 1;
      continue;
    }
    // Only seed when unset so admin changes are preserved after first assign
    if (user.org != null) {
      skipped += 1;
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { org: desired }
    });
    updated += 1;
    console.log(`[bootstrap] ${user.username} → ${desired}`);
  }

  console.log(`[bootstrap] User orgs: ${updated} set, ${skipped} already set/skipped.`);
}

main()
  .catch(err => {
    console.error("[bootstrap] Failed to seed user orgs:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
