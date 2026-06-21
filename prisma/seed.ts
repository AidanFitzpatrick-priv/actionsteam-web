import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) {
    console.log("SEED_ADMIN_EMAIL not set — skipping management user seed.");
    return;
  }

  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMeNow123!";
  const mustReset = !process.env.SEED_ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    console.log(`Seed user already exists: ${existing.username}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username,
      passwordHash,
      role: "management",
      mustResetPassword: mustReset
    }
  });

  console.log(`Created management user: ${user.username} (${user.email})`);
  if (mustReset) {
    console.log("Temporary password:", password, "— set SEED_ADMIN_PASSWORD or change after first login.");
  }

  const typeCount = await prisma.actionType.count();
  if (typeCount === 0) {
    await prisma.actionType.createMany({
      data: [
        { name: "Raid", colourHex: "#fce5cd" },
        { name: "Deal", colourHex: "#d9ead3" },
        { name: "Other", colourHex: "#cfe2f3" }
      ]
    });
    await prisma.gang.createMany({
      data: [
        { name: "Ballas" },
        { name: "Vagos" },
        { name: "Families" }
      ]
    });
    console.log("Seeded sample action types and gangs.");
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
