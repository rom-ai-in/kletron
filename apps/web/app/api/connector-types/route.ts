import { NextResponse } from 'next/server';

interface ConnectorType {
  id: string;
  name: string;
  description: string;
}

export async function GET() {
  const connectorTypes: ConnectorType[] = [
    { id: "github", name: "GitHub", description: "GitHub repository access" },
    { id: "slack", name: "Slack", description: "Slack chat integration" },
    { id: "google-drive", name: "Google Drive", description: "Cloud storage" },
    { id: "stripe", name: "Stripe", description: "Payment processing" },
  ];

  return NextResponse.json(connectorTypes);
}
