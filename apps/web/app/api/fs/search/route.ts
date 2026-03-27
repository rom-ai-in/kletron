import { NextResponse } from "next/server";
import { exec } from "child_process";
import util from "util";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

const execPromise = util.promisify(exec);

export type SearchResult = {
  file: string;
  line?: number;
  text?: string;
  matchType: "file" | "content";
};

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const searchType = searchParams.get("type") === "content" ? "content" : "file";

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }
  const rootDir = workspace.rootPath;

  try {
    let results: SearchResult[] = [];

    if (searchType === "file") {
      const findCmd = `find . -type f -not -path '*/.*' -not -path '*/node_modules/*' -iname '*${query}*' | head -n 100`;
      const { stdout } = await execPromise(findCmd, { cwd: rootDir, maxBuffer: 1024 * 1024 });
      results = stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => ({
          file: line.startsWith("./") ? line.substring(2) : line,
          matchType: "file" as const,
        }));
    } else {
      const grepCmd = `grep -rniI --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next "${query}" . | head -n 100`;
      const { stdout } = await execPromise(grepCmd, { cwd: rootDir, maxBuffer: 1024 * 1024 });

      results = stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const firstColon = line.indexOf(":");
          const secondColon = line.indexOf(":", firstColon + 1);

          if (firstColon === -1 || secondColon === -1) return null;

          const file = line.substring(0, firstColon);
          const lineNum = parseInt(line.substring(firstColon + 1, secondColon), 10);
          const text = line.substring(secondColon + 1);

          const result: SearchResult = {
            file: file.startsWith("./") ? file.substring(2) : file,
            line: lineNum,
            text: text.trim(),
            matchType: "content" as const,
          };
          return result;
        })
        .filter((item): item is SearchResult => item !== null);
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Search failed:", error);
    if (error.code === 1 && error.stdout === "") {
      return NextResponse.json({ results: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
