import { NextResponse } from "next/server";

/** Railway healthcheck — no database, no layout. */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
