// Backward-compat shim. Prefer /api/connectors/types.
import { NextResponse } from "next/server";
import { listConnectorTypes } from "@kletron/shared";

export const dynamic = "force-static";

export async function GET() {
    const types = listConnectorTypes();
    return NextResponse.json(
        types.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
        }))
    );
}
