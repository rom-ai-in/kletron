import { NextResponse } from "next/server";
import { listPromptDirs } from "../utils";

export async function GET() {
  try {
    const dirs = await listPromptDirs();
    return NextResponse.json({ dirs });
  } catch (error) {
    return NextResponse.json(
      { dirs: [], error: (error as Error).message || "Unable to load prompt folders." },
      { status: 500 }
    );
  }
}
