import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const folderPath = body.path;

        if (!folderPath || typeof folderPath !== "string") {
            return NextResponse.json(
                { valid: false, error: "Path is required" },
                { status: 400 }
            );
        }

        const resolvedPath = path.resolve(folderPath);

        // Check if path exists
        if (!fs.existsSync(resolvedPath)) {
            return NextResponse.json({
                valid: false,
                error: "Path does not exist"
            });
        }

        // Check if path is a directory
        const stats = fs.statSync(resolvedPath);
        if (!stats.isDirectory()) {
            return NextResponse.json({
                valid: false,
                error: "Path is not a directory"
            });
        }

        // Path is valid
        return NextResponse.json({
            valid: true
        });
    } catch (e: any) {
        return NextResponse.json(
            { valid: false, error: e.message || "Validation failed" },
            { status: 500 }
        );
    }
}
