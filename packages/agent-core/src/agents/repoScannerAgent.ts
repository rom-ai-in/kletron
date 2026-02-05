
import * as fs from "fs/promises";
import * as path from "path";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { RepoAnalysisResult, RepoGraphEdge, RepoGraphNode } from "@numezis/shared/types";
import { getChatModel } from "@numezis/server/llm";
import { AuditContext } from "@numezis/shared/documentContext";

// Max depth for directory scanning to prevent overload
const MAX_SCAN_DEPTH = 3;
const MAX_FILES_PER_DIR = 20;

const IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    ".vercel",
    ".turbo",
]);

const IGNORED_FILES = new Set([
    ".DS_Store",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
]);

/**
 * Scans a directory recursively and builds a node/edge graph.
 */
async function scanDirectory(
    rootDir: string,
    currentDir: string,
    depth: number,
    nodes: RepoGraphNode[],
    edges: RepoGraphEdge[],
    parentId?: string
) {
    if (depth > MAX_SCAN_DEPTH) return;

    const entries = await fs.readdir(currentDir, { withFileTypes: true }).catch(() => []);

    // Sort: Directories first, then files
    entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
    });

    let fileCount = 0;

    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue; // Skip dotfiles generally
        if (IGNORED_FILES.has(entry.name)) continue;
        if (IGNORED_DIRS.has(entry.name)) continue;

        const fullPath = path.join(currentDir, entry.name);
        const relativePath = path.relative(rootDir, fullPath);
        const id = relativePath || "root"; // Using relative path as ID

        // Limit files to avoid clutter
        if (!entry.isDirectory()) {
            fileCount++;
            if (fileCount > MAX_FILES_PER_DIR) continue;
        }

        const node: RepoGraphNode = {
            id,
            label: entry.name,
            type: entry.isDirectory() ? "directory" : "file",
            path: relativePath,
            parentId,
        };

        nodes.push(node);

        if (parentId) {
            edges.push({
                id: `${parentId}-${id}`,
                source: parentId,
                target: id,
            });
        }

        if (entry.isDirectory()) {
            await scanDirectory(rootDir, fullPath, depth + 1, nodes, edges, id);
        }
    }
}

/**
 * Generates the semantic "Soul" of the project using an LLM.
 */
async function generateProjectSoul(
    rootDir: string,
    fileTree: string
): Promise<RepoAnalysisResult["structureContext"]> {
    // Lightweight model preferred for speed/cost if available, otherwise default
    const model = await getChatModel({}, { temperature: 0.2 });

    // Read key files for context
    let packageJson = "";
    try {
        packageJson = await fs.readFile(path.join(rootDir, "package.json"), "utf-8");
    } catch (e) { }

    let readme = "";
    try {
        readme = (await fs.readFile(path.join(rootDir, "README.md"), "utf-8")).slice(0, 2000); // Truncate
    } catch (e) { }

    const prompt = `You are an expert software architect. Analyze the following project structure and metadata to define its "Soul".

  File Tree (Truncated):
  ${fileTree}

  Package.json:
  ${packageJson}

  README (Snippet):
  ${readme}

  Output a JSON object with the following fields:
  - mission: A 1-sentence description of what this project does and who it is for.
  - invariants: A list of 3-5 critical technical rules or patterns detected (e.g., "Use Atomic Design", "Next.js App Router").
  - techStack: A list of key technologies (e.g., "Next.js", "MongoDB", "Tailwind").
  - architectureType: A short phrase describing the architecture (e.g., "Modular Monolith", "Microservices", "Script Collection").

  JSON ONLY. NO MARKDOWN.
  `;

    const response = await model.invoke([
        new SystemMessage("You are a strict JSON generator."),
        new HumanMessage(prompt)
    ]);

    const content = typeof response.content === "string" ? response.content : "";

    try {
        // Clean markdown code blocks if present
        const cleanJson = content.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (e) {
        console.error("Failed to parse LLM response for Soul", content);
        return {
            mission: "Analysis failed to generate mission.",
            invariants: [],
            techStack: [],
            architectureType: "Unknown"
        }
    }
}

export async function runRepoAnalysis(
    rootDir: string,
    onProgress?: (msg: string) => void
): Promise<RepoAnalysisResult> {

    onProgress?.("Starting directory scan...");

    const nodes: RepoGraphNode[] = [];
    const edges: RepoGraphEdge[] = [];

    // 1. Build Graph
    onProgress?.(`Scanning ${rootDir}...`);
    await scanDirectory(rootDir, rootDir, 0, nodes, edges);

    onProgress?.(`Found ${nodes.length} nodes. Generating semantic soul...`);

    // 2. Prepare context for LLM
    // Create a simplified tree string for the prompt
    const treeRepresentation = nodes
        .filter(n => n.type === "directory" || n.path.endsWith(".json") || n.path.endsWith(".md") || n.path.endsWith("layout.tsx"))
        .map(n => n.path)
        .slice(0, 100) // Limit to 100 significant paths
        .join("\n");

    // 3. LLM Synthesis
    const soul = await generateProjectSoul(rootDir, treeRepresentation);
    onProgress?.("Analysis complete.");

    return {
        nodes,
        edges,
        structureContext: soul
    };
}
