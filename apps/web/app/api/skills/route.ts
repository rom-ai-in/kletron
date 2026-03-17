import { NextResponse } from "next/server";
import { skillRegistry } from "@kletron/agent-core/skills/registry";

/**
 * GET /api/skills
 * List all available skills with their metadata.
 */
export async function GET() {
    try {
        const skills = await skillRegistry.listAll();

        return NextResponse.json({
            skills: skills.map((s) => ({
                id: s.id,
                name: s.name,
                version: s.version,
                description: s.description,
                tags: s.tags ?? [],
                extends: s.extends ?? [],
                requiredTools: s.requiredTools ?? [],
                suggestedTools: s.suggestedTools ?? [],
            })),
            count: skills.length,
        });
    } catch (error) {
        console.error("[API /skills] Error listing skills:", error);
        return NextResponse.json(
            { error: "Failed to list skills", details: String(error) },
            { status: 500 }
        );
    }
}
