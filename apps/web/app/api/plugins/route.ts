import { NextResponse } from "next/server";
import { listPlugins } from "@kletron/shared";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({ plugins: listPlugins() });
}
