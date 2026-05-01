import { describe, expect, it } from "vitest";
import {
    PLUGIN_CATALOG,
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
            expect(v, `plugin ${p.id}`).toEqual({ ok: true });
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
