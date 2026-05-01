import { describe, expect, it } from "vitest";
import {
    PLUGIN_CATALOG,
    collectSkillSlugsFromPluginIds,
    listPlugins,
    getPlugin,
    validatePluginRefs,
} from "../src/plugins/catalog";
import { getConnectorType } from "../src/connectors/catalog";
import { SLUG_REGEX } from "../src/skills/types";

describe("PLUGIN_CATALOG", () => {
    it("has unique plugin ids", () => {
        const ids = PLUGIN_CATALOG.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("listPlugins returns a copy", () => {
        const a = listPlugins();
        const b = listPlugins();
        expect(a).not.toBe(b);
        expect(a).toEqual(b);
    });

    it("getPlugin resolves each id", () => {
        for (const p of PLUGIN_CATALOG) {
            expect(getPlugin(p.id)).toEqual(p);
        }
    });

    it("every connector id exists in CONNECTOR_CATALOG", () => {
        for (const p of PLUGIN_CATALOG) {
            const v = validatePluginRefs(p);
            expect(v).toEqual({ ok: true });
            for (const cid of p.connectorIds) {
                expect(getConnectorType(cid), cid).toBeDefined();
            }
        }
    });

    it("every skill slug matches SLUG_REGEX", () => {
        for (const p of PLUGIN_CATALOG) {
            for (const slug of p.skillSlugs) {
                expect(SLUG_REGEX.test(slug), slug).toBe(true);
            }
        }
    });
});

describe("collectSkillSlugsFromPluginIds", () => {
    it("returns empty set for empty ids", () => {
        expect(collectSkillSlugsFromPluginIds([]).size).toBe(0);
    });

    it("skips unknown plugin ids", () => {
        const s = collectSkillSlugsFromPluginIds(["not-a-real-plugin-id"]);
        expect(s.size).toBe(0);
    });

    it("unions skill slugs from multiple plugins", () => {
        const s = collectSkillSlugsFromPluginIds(["figma", "data"]);
        expect(s.has("figma-code-connect")).toBe(true);
        expect(s.has("sql-queries")).toBe(true);
    });

    it("dedupes when the same plugin id appears more than once", () => {
        const p = getPlugin("productivity")!;
        const s = collectSkillSlugsFromPluginIds(["productivity", "productivity"]);
        expect(s.size).toBe(p.skillSlugs.length);
        for (const slug of p.skillSlugs) expect(s.has(slug)).toBe(true);
    });

    it("merges disjoint plugins without double-counting shared connector-only overlap", () => {
        const p = getPlugin("productivity")!;
        const f = getPlugin("figma")!;
        const s = collectSkillSlugsFromPluginIds(["productivity", "figma"]);
        expect(s.size).toBe(p.skillSlugs.length + f.skillSlugs.length);
    });
});
