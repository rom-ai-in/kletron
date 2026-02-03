import { NextRequest, NextResponse } from "next/server";
import { skillRegistry } from "@/src/skills/registry";

type Params = { params: Promise<{ skillId: string }> };

/**
 * GET /api/skills/[skillId]
 * Get a resolved skill by ID (includes inherited prompts and tools).
 */
export async function GET(_req: NextRequest, { params }: Params) {
    const { skillId } = await params;

    if (!skillId) {
        return NextResponse.json({ error: "Missing skillId" }, { status: 400 });
    }

    try {
        const skill = await skillRegistry.getSkill(skillId);

        return NextResponse.json({
            id: skill.id,
            name: skill.name,
            version: skill.version,
            description: skill.description,
            tags: skill.tags ?? [],
            extends: skill.extends ?? [],
            extendsChain: skill.extendsChain,
            requiredTools: skill.requiredTools ?? [],
            suggestedTools: skill.suggestedTools ?? [],
            resolvedTools: skill.resolvedTools,
            systemPrompt: skill.resolvedSystemPrompt,
            outputFormat: skill.outputFormat,
            maxToolCalls: skill.maxToolCalls,
        });
    } catch (error) {
        console.error(`[API /skills/${skillId}] Error:`, error);
        return NextResponse.json(
            { error: "Skill not found", skillId, details: String(error) },
            { status: 404 }
        );
    }
}
