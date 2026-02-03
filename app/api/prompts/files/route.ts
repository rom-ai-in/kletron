export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { listPromptFiles, listAllPromptFiles } from "../utils";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const dir = url.searchParams.get("dir") ?? "";
  const recursive = url.searchParams.get("recursive") === "true";

  try {
    const files = recursive ? await listAllPromptFiles() : await listPromptFiles(dir);
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { files: [], error: (error as Error).message || "Unable to load prompt files." },
      { status: 400 }
    );
  }
}
