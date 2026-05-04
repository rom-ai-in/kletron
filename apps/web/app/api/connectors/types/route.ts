// Static catalog of connector type definitions.
// Used by the web UI to show "browse providers" and the OAuth/API-key forms.

import { NextResponse } from "next/server";
import { listConnectorTypes } from "@kletron/shared";

export const dynamic = "force-static";

export async function GET() {
    return NextResponse.json({ types: listConnectorTypes() });
}
