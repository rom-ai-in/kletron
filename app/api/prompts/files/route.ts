import { NextResponse } from "next/server";
import { listPromptFiles, listAllPromptFiles } from "../utils";

export async function GET(request: Request) {
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
