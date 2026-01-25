import { getDb } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  // Quote only when needed (RFC4180-ish)
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET() {
  const db = await getDb();
  const col = db.collection("i18n_translations");

  const encoder = new TextEncoder();
  const bom = "\uFEFF"; // Excel-friendly UTF-8 BOM

  const headers = [
    "key",
    "namespace",
    "source_file",
    "context_usage",
    "en",
    "de",
    "fr",
    "it",
    "status",
    "reviewed",
  ];
  const filename = `i18n-export-all-${new Date().toISOString().slice(0, 10)}.csv`;

  let cancelled = false;
  const cursor = col
    .find(
      {},
      {
        projection: {
          _id: 0,
          key: 1,
          namespace: 1,
          source_file: 1,
          context_usage: 1,
          en: 1,
          de: 1,
          fr: 1,
          it: 1,
          status: 1,
          reviewed: 1,
        },
      }
    )
    .sort({ namespace: 1, key: 1 });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(bom + headers.join(",") + "\n"));
        for await (const doc of cursor as any) {
          if (cancelled) break;
          const row = headers
            .map((h) => csvCell((doc as any)[h]))
            .join(",");
          controller.enqueue(encoder.encode(row + "\n"));
        }
      } catch (e) {
        controller.error(e);
      } finally {
        try {
          await cursor.close();
        } catch {
          // ignore
        }
        controller.close();
      }
    },
    async cancel() {
      cancelled = true;
      try {
        await cursor.close();
      } catch {
        // ignore
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

