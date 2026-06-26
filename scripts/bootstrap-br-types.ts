import { ensureBrActionTypes } from "../src/services/reference-data";
import { prisma } from "../src/lib/db";

ensureBrActionTypes()
  .then(() => {
    console.log("[bootstrap] BR action types ensured.");
  })
  .catch(err => {
    console.error("[bootstrap] Failed to ensure BR action types:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
