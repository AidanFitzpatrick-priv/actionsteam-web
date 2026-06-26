import { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, getMeta } from "@/lib/api";
import { requestPasswordReset } from "@/services/password-reset";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address")
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    const meta = getMeta(req);
    await requestPasswordReset({ email: body.email, ipAddress: meta.ipAddress });
    return jsonOk({
      ok: true,
      message: "If an account exists for that email, we sent a reset link."
    });
  } catch (e) {
    return jsonError(e);
  }
}
