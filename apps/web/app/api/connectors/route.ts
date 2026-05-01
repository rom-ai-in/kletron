import { NextResponse } from 'next/server';
import { requireAppRouteAuth } from '@kletron/server/lib/auth/apiAuth';

interface Connector {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  config?: Record<string, string>;
}

const CONNECTORS_DB: Connector[] = [
  { id: "1", name: "GitHub", type: "git", connected: false },
  { id: "2", name: "Slack", type: "chat", connected: false },
  { id: "3", name: "Google Drive", type: "storage", connected: false },
];

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return a copy to avoid mutation
  return NextResponse.json([...CONNECTORS_DB]);
}

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { connectorId, connected } = body;

  // Update in database (mock)
  const index = CONNECTORS_DB.findIndex(c => c.id === connectorId);
  if (index !== -1) {
    CONNECTORS_DB[index] = { ...CONNECTORS_DB[index], connected };
  }

  return NextResponse.json(
    { success: true, connectorId, connected },
    { status: 200 }
  );
}
