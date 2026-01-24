import { NextResponse } from "next/server";
import { I18nStatusSchema, listTranslations } from "@/src/services/i18nTranslationsService";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const namespace = url.searchParams.get("namespace") ?? undefined;
  const statusRaw = url.searchParams.get("status") ?? undefined;
  const reviewedRaw = url.searchParams.get("reviewed") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const offsetRaw = url.searchParams.get("offset");

  const status = statusRaw ? I18nStatusSchema.safeParse(statusRaw).data : undefined;
  const reviewed =
    reviewedRaw === "true" ? true : reviewedRaw === "false" ? false : undefined;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined;

  try {
    const { total, rows } = await listTranslations({ q, namespace, status, reviewed, limit, offset });
    return NextResponse.json({ total, rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to list translations" }, { status: 500 });
  }
}

