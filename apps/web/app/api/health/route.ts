import { NextResponse } from "next/server";

/**
 * Lightweight reachability check for desktop clients (no auth).
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
