import { NextResponse } from "next/server";
import { listPromptDirs } from "../utils";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

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
