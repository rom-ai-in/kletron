import { afterEach, describe, expect, it } from "vitest";
import { resolveDemoCredentials } from "../lib/demoCredentials";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("resolveDemoCredentials", () => {
    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    });

    it("resolves the built-in demo account outside production", async () => {
        process.env.NODE_ENV = "test";

        const profile = await resolveDemoCredentials("romain-client@gmail.com", "password123");

        expect(profile).toEqual({
            id: "test-user-1",
            email: "romain-client@gmail.com",
            name: "Romain Client",
        });
    });

    it("refuses the built-in demo account in production", async () => {
        process.env.NODE_ENV = "production";

        const profile = await resolveDemoCredentials("romain-client@gmail.com", "password123");

        expect(profile).toBeNull();
    });
});
