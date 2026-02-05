import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";

export interface TreeNode {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: TreeNode[];
}

function buildTree(currentPath: string, depth: number = 0, maxDepth: number = 5): TreeNode[] {
  if (depth > maxDepth) return [];

  const nodes: TreeNode[] = [];
  try {
    const files = fs.readdirSync(currentPath);

    files.sort((a, b) => {
      const aPath = path.join(currentPath, a);
      const bPath = path.join(currentPath, b);
      const aIsDir = fs.statSync(aPath).isDirectory();
      const bIsDir = fs.statSync(bPath).isDirectory();

      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.localeCompare(b);
    });

    for (const file of files) {
      if (file.startsWith(".") && file !== ".agent") continue;
      if (file === "node_modules") continue;

      const fullPath = path.join(currentPath, file);
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch (e) {
        continue;
      }

      const isDirectory = stats.isDirectory();

      const node: TreeNode = {
        path: fullPath,
        name: file,
        isDirectory,
      };

      if (isDirectory) {
        node.children = buildTree(fullPath, depth + 1, maxDepth);
      }

      nodes.push(node);
    }
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error);
  }
  return nodes;
}

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const root = searchParams.get("root");
    const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
    if (!workspace || !workspace._id) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }
    const repoRoot = workspace.rootPath;

    let rootPath = repoRoot;

    if (typeof root === "string" && root) {
      const resolvedRoot = path.isAbsolute(root) ? path.resolve(root) : path.resolve(repoRoot, root);
      if (resolvedRoot.startsWith(repoRoot)) {
        rootPath = resolvedRoot;
      } else {
        return NextResponse.json(
          { error: "Access denied: root outside of repository root" },
          { status: 403 }
        );
      }
    }

    const tree = buildTree(rootPath);
    const response = NextResponse.json(tree);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    return response;
  } catch (error) {
    return NextResponse.json({ error: "Failed to build file tree" }, { status: 500 });
  }
}
