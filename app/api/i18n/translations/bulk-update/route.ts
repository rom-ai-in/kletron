import { NextResponse } from "next/server";
import { z } from "zod";
import { bulkUpdateTranslations } from "@/src/services/i18nTranslationsService";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UpdateSchema = z.object({
  rowKey: z.string().min(1),
  proposed: z.object({
    en: z.string().optional(),
    de: z.string().optional(),
    fr: z.string().optional(),
    it: z.string().optional(),
  }),
});

const BodySchema = z.object({
  updates: z.array(UpdateSchema).min(1).max(5000),
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
    const res = await bulkUpdateTranslations(body.updates);
    return NextResponse.json({ success: true, ...res });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Bulk update failed" }, { status: 400 });
  }
}

