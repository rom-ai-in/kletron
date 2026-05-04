// Compatibility shim: the old global mock connectors API is gone. Returns
// the typed catalog as a flat list so older clients still get something
// useful while we migrate them to /api/connectors/types and the per-workspace
// CRUD under /api/workspaces/[workspaceId]/connectors/...

import { NextResponse } from "next/server";
import { listConnectorTypes } from "@kletron/shared";

export const dynamic = "force-static";

export async function GET() {
    const types = listConnectorTypes();
    return NextResponse.json(
        types.map((t) => ({
            id: t.id,
            name: t.name,
            type: t.category,
            description: t.description,
        }))
    );
}
