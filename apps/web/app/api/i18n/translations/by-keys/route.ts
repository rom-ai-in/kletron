import { NextResponse } from "next/server";
import { z } from "zod";
import { getTranslationsByRowKeys, toRowKey } from "@numezis/server/services/i18nTranslationsService";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  rowKeys: z.array(z.string().min(1)).min(1).max(5000),
});

export async function POST(req: Request) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = BodySchema.parse(await req.json());
    const rows = await getTranslationsByRowKeys(body.rowKeys);
    // Return in the same ordering as rowKeys for predictable UI.
    const map = new Map(rows.map((r) => [toRowKey(r), r]));
    const ordered = body.rowKeys.map((k) => map.get(k)).filter(Boolean);
    return NextResponse.json({ rows: ordered });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to load rows" }, { status: 400 });
  }
}

