import { NextResponse } from 'next/server';

// Mock data - in production this would connect to the database
export async function GET() {
  const workspaces = [
    { id: "1", name: "My Project", path: "/Users/romainmagnin/Desktop/project" },
    { id: "2", name: "Work Documents", path: "/Users/romainmagnin/Documents/work" },
  ];

  return NextResponse.json(workspaces);
}

export async function POST(request: Request) {
  const { name, rootPath } = await request.json();
  const path = rootPath || name;

  console.log('Creating workspace:', { name, rootPath: path });

  return NextResponse.json(
    { workspace: { id: Date.now().toString(), name: name || path, rootPath: path } },
    { status: 201 }
  );
}
