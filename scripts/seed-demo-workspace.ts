/**
 * Idempotent demo seed: local Mongo user + org + quickstart workspace + default graphs.
 *
 * Prerequisites: MongoDB running (e.g. `docker compose up -d mongo`), `.env` with MONGODB_URI.
 *
 * Usage (repo root):
 *   npm run seed:demo
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { getDb, closeDb } from "@kletron/server/lib/db";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { buildSimpleReactAgentGraph } from "@kletron/server/services/agentGraphPresets";
import * as organizationService from "@kletron/server/services/organizationService";
import * as userProfileService from "@kletron/server/services/userProfileService";
import { createWorkspace, setActiveWorkspaceId } from "@kletron/server/services/workspaceService";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(ROOT, ".env.local") });
dotenv.config({ path: path.join(ROOT, ".env") });
dotenv.config();

const DEMO_EMAIL = "demo@kletron.local";
const DEMO_PASSWORD = "kletron-demo";
const DEMO_NAME = "Demo Developer";

async function seedSimpleReactGraph(): Promise<void> {
    const graph = buildSimpleReactAgentGraph();
    const existing = await agentGraphService.listGraphs({ search: "Simple ReAct" });
    const matches = existing.filter((g) => g.name === graph.name);
    const keep = matches[0];
    if (keep?._id) {
        const duplicates = matches.slice(1);
        for (const dup of duplicates) {
            if (dup._id) await agentGraphService.deleteGraph(String(dup._id));
        }
        await agentGraphService.updateGraph(String(keep._id), {
            nodes: graph.nodes,
            edges: graph.edges,
            description: graph.description,
        });
        return;
    }
    await agentGraphService.createGraph(graph);
}

async function main() {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not set. Copy env.example to .env and start Mongo (e.g. docker compose up -d mongo).");
    }

    const quickstartRoot = path.join(ROOT, "examples", "quickstart-workspace");
    if (!fs.existsSync(path.join(quickstartRoot, "src", "greeting.ts"))) {
        throw new Error(`Missing ${quickstartRoot}. Clone the full Kletron repo.`);
    }

    const db = await getDb();
    const usersCollection = db.collection("users");
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

    let userId: string;
    const existing = await usersCollection.findOne({ email: DEMO_EMAIL });
    const now = new Date();

    if (existing?._id) {
        userId = existing._id.toString();
        await usersCollection.updateOne(
            { _id: existing._id },
            {
                $set: {
                    passwordHash,
                    password: passwordHash,
                    name: DEMO_NAME,
                    updatedAt: now,
                },
            }
        );
    } else {
        const result = await usersCollection.insertOne({
            _id: new ObjectId(),
            email: DEMO_EMAIL,
            passwordHash,
            password: passwordHash,
            name: DEMO_NAME,
            createdAt: now,
            updatedAt: now,
        });
        userId = result.insertedId.toString();
    }

    await userProfileService.upsertProfile(userId, DEMO_EMAIL, DEMO_NAME);
    await organizationService.ensureOrganizationForUser(userId, {
        email: DEMO_EMAIL,
        fullName: DEMO_NAME,
    });

    const workspace = await createWorkspace({
        ownerId: userId,
        rootPath: quickstartRoot,
        name: "Quickstart workspace",
    });
    await setActiveWorkspaceId(userId, workspace._id?.toString() ?? null);

    await agentGraphService.ensureDefaultGraphs();
    await seedSimpleReactGraph();

     
    console.log(
        JSON.stringify(
            {
                ok: true,
                loginUrl: process.env.NEXT_PUBLIC_APP_URL
                    ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/auth/login`
                    : "http://localhost:3000/auth/login",
                email: DEMO_EMAIL,
                password: DEMO_PASSWORD,
                workspaceRoot: quickstartRoot,
                userId,
                workspaceId: workspace._id?.toString(),
            },
            null,
            2
        )
    );
}

main()
    .catch((err) => {
         
        console.error("seed:demo failed:", err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await closeDb().catch(() => undefined);
    });
