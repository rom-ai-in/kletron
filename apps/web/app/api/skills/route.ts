import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

interface SkillFile {
  id: string;
  name: string;
  description: string;
  filePath: string;
  enabled: boolean;
}

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
    if (!workspace || !workspace._id) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }
    const repoRoot = workspace.rootPath;

    const skillsDir = path.join(repoRoot, ".claude", "skills");

    if (!fs.existsSync(skillsDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(skillsDir);
    const skillFiles: SkillFile[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        const fullPath = path.join(skillsDir, file);
        const stats = fs.statSync(fullPath);
        
        if (stats.isFile()) {
          const name = path.basename(file, '.md');
          let description = '';
          
          // Try to read first line as description
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');
            if (lines.length > 0) {
              description = lines[0].replace(/^#\s*/, '').trim();
            }
          } catch (e) {
            // Ignore read errors
          }

          skillFiles.push({
            id: fullPath,
            name: name,
            description: description || '',
            filePath: fullPath,
            enabled: true
          });
        }
      }
    }

    return NextResponse.json(skillFiles);
  } catch (error) {
    console.error("Error listing skills:", error);
    return NextResponse.json({ error: "Failed to list skills" }, { status: 500 });
  }
}
