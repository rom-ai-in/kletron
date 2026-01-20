import { NextResponse } from "next/server";

import { mcpToolMetadata } from "../../../../src/tools/mcpToolMetadata";

export async function GET() {
  return NextResponse.json(mcpToolMetadata);
}
