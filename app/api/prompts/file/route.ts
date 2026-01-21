import { NextResponse } from "next/server";
import { readPromptFile } from "../utils";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filePath = url.searchParams.get("path") ?? "";

  if (!filePath) {
    return NextResponse.json(
      { error: "Missing prompt path." },
      { status: 400 }
    );
  }

  try {
    const content = await readPromptFile(filePath);
    return NextResponse.json({ path: filePath, content });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Unable to load prompt file." },
      { status: 400 }
    );
  }
}
