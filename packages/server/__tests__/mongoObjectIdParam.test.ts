import { describe, expect, it } from "vitest";

import { isMongoObjectIdParam } from "../src/services/workspaceService";

describe("isMongoObjectIdParam", () => {
    it("accepts 24-char hex ids", () => {
        expect(isMongoObjectIdParam("507f1f77bcf86cd799439011")).toBe(true);
        expect(isMongoObjectIdParam(" 507f191e810c19729de860ea ")).toBe(true);
    });

    it("rejects garbage and wrong lengths", () => {
        expect(isMongoObjectIdParam("")).toBe(false);
        expect(isMongoObjectIdParam("not-hex-not-hex-not-hex-no")).toBe(false);
        expect(isMongoObjectIdParam("507f1f77bcf86cd79943901")).toBe(false);
        expect(isMongoObjectIdParam(undefined)).toBe(false);
    });
});
