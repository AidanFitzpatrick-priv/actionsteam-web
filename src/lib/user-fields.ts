import { z } from "zod";

export const cityIdSchema = z
  .string()
  .trim()
  .min(1, "City ID is required")
  .max(64, "City ID is too long");

export const discordIdSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(v => !v || /^\d{17,20}$/.test(v), "Discord ID must be 17–20 digits");

export function normalizeCityId(raw: string): string {
  return raw.trim();
}
