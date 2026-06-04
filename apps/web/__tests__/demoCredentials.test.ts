import { afterEach, describe, expect, it } from "vitest";
import { resolveDemoCredentials } from "../lib/demoCredentials";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("resolveDemoCredentials", () => {
    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    });

    it("resolves the built-in demo account outside production", async () => {
        process.env.NODE_ENV = "test";

        const profile = await resolveDemoCredentials("demo@kletron.local", "kletron-demo");

        expect(profile).toEqual({
            id: "test-user-1",
            email: "demo@kletron.local",
            name: "Demo User",
        });
    });

    it("refuses the built-in demo account in production", async () => {
        process.env.NODE_ENV = "production";

        const profile = await resolveDemoCredentials("demo@kletron.local", "kletron-demo");

        expect(profile).toBeNull();
    });
});
