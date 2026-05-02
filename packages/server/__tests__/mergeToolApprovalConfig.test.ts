import { describe, expect, it } from "vitest";

import type { ToolApprovalConfig } from "../src/config";
import { mergeToolApprovalConfigUpdates } from "../src/config";

describe("mergeToolApprovalConfigUpdates", () => {
    it("merges scalar patches into current config", () => {
        const current: ToolApprovalConfig = {
            autoApproveReadonlySources: ["agent"],
            neverAutoApproveTools: [],
            autoApproveSafeBash: true,
            toolOverrides: {},
            defaultThreadApprovalMode: "inherit",
        };
        const out = mergeToolApprovalConfigUpdates(current, { autoApproveSafeBash: false });
        expect(out.autoApproveSafeBash).toBe(false);
        expect(out.autoApproveReadonlySources).toEqual(["agent"]);
        expect(out.defaultThreadApprovalMode).toBe("inherit");
    });

    it("shallow-merges toolOverrides unless replaceToolOverrides", () => {
        const current: ToolApprovalConfig = {
            autoApproveReadonlySources: [],
            neverAutoApproveTools: [],
            autoApproveSafeBash: true,
            toolOverrides: { x: "always_require" },
            defaultThreadApprovalMode: "inherit",
        };
        const merged = mergeToolApprovalConfigUpdates(current, {
            toolOverrides: { y: "always_approve" },
        });
        expect(merged.toolOverrides).toEqual({ x: "always_require", y: "always_approve" });
    });

    it("replaces toolOverrides when replaceToolOverrides is true", () => {
        const current: ToolApprovalConfig = {
            autoApproveReadonlySources: [],
            neverAutoApproveTools: [],
            autoApproveSafeBash: true,
            toolOverrides: { x: "always_require" },
            defaultThreadApprovalMode: "inherit",
        };
        const out = mergeToolApprovalConfigUpdates(current, {
            replaceToolOverrides: true,
            toolOverrides: { y: "always_approve" },
        });
        expect(out.toolOverrides).toEqual({ y: "always_approve" });
    });
});
