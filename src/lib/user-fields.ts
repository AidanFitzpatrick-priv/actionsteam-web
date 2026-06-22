import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username is too long")
  .regex(/^[a-zA-Z0-9_\-]+$/, "Username may only contain letters, numbers, _ and -");

export const cityIdSchema = z
  .string()
  .trim()
  .min(1, "City ID is required")
  .max(64, "City ID is too long");

export const optionalCityIdSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(v => !v || (v.length >= 1 && v.length <= 64), "City ID must be 1–64 characters");

export const discordIdSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .refine(v => !v || /^\d{17,20}$/.test(v), "Discord ID must be 17–20 digits");

export function normalizeCityId(raw: string): string {
  return raw.trim();
}
