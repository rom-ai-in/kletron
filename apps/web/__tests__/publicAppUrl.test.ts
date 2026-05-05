import { afterEach, describe, expect, it } from "vitest";
import { getPublicAppOrigin } from "../lib/publicAppUrl";

const ORIGINAL_NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL;
const ORIGINAL_NEXTAUTH_URL = process.env.NEXTAUTH_URL;

describe("getPublicAppOrigin", () => {
    afterEach(() => {
        if (ORIGINAL_NEXT_PUBLIC_APP_URL === undefined) {
            delete process.env.NEXT_PUBLIC_APP_URL;
        } else {
            process.env.NEXT_PUBLIC_APP_URL = ORIGINAL_NEXT_PUBLIC_APP_URL;
        }

        if (ORIGINAL_NEXTAUTH_URL === undefined) {
            delete process.env.NEXTAUTH_URL;
        } else {
            process.env.NEXTAUTH_URL = ORIGINAL_NEXTAUTH_URL;
        }
    });

    it("normalizes the public origin from NEXT_PUBLIC_APP_URL", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://example.com/app/";

        expect(getPublicAppOrigin()).toBe("https://example.com");
    });

    it("ignores the first-deploy placeholder and falls back to NEXTAUTH_URL", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://change-me-after-first-deploy.run.app";
        process.env.NEXTAUTH_URL = "https://auth.example.com/base";

        expect(getPublicAppOrigin()).toBe("https://auth.example.com");
    });

    it("uses the local request origin during development when env vars are absent", () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.NEXTAUTH_URL;

        const request = new Request("http://127.0.0.1:3000/api/auth/connect/gmail");
        expect(getPublicAppOrigin(request)).toBe("http://127.0.0.1:3000");
    });

    it("falls back to the canonical production origin when no usable env is set", () => {
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.NEXTAUTH_URL;

        const request = new Request("https://www.kletron.com/api/auth/connect/gmail");
        expect(getPublicAppOrigin(request)).toBe("https://www.kletron.com");
    });
});
