import { NextResponse } from "next/server";
import { listPromptFiles } from "../utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dir = url.searchParams.get("dir") ?? "";

  try {
    const files = await listPromptFiles(dir);
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { files: [], error: (error as Error).message || "Unable to load prompt files." },
      { status: 400 }
    );
  }
}
