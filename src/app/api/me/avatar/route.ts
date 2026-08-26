import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk, requireUser, getMeta, ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseAvatarDataUrl } from "@/lib/avatars";
import { writeAuditLog } from "@/lib/audit";

export async function GET() {
  try {
    const user = await requireUser();
    const avatar = await prisma.userAvatar.findUnique({ where: { userId: user.id } });
    if (!avatar) throw new ApiError(404, "No profile photo");
    return new NextResponse(Uint8Array.from(avatar.data), {
      headers: {
        "Content-Type": avatar.mime,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = z.object({ image: z.string().min(1) }).parse(await req.json());
    const { buf, mime } = parseAvatarDataUrl(body.image);
    const data = Uint8Array.from(buf);
    const now = new Date();

    await prisma.$transaction([
      prisma.userAvatar.upsert({
        where: { userId: user.id },
        create: { userId: user.id, mime, data },
        update: { mime, data }
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { avatarUpdatedAt: now }
      })
    ]);

    const meta = getMeta(req);
    await writeAuditLog({
      userId: user.id,
      action: "user.avatar_update",
      entityType: "user",
      entityId: user.id,
      payload: { username: user.username },
      ipAddress: meta.ipAddress
    });

    return jsonOk({ ok: true, avatarUpdatedAt: now.toISOString() });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose an image file" }, { status: 400 });
    }
    if (e instanceof Error && /JPEG|PNG|WebP|GIF|2 MB|valid image/.test(e.message)) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return jsonError(e);
  }
}
