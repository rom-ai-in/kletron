import path from "node:path";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

type Args = {
  ownerId?: string;
  ownerEmail?: string;
  onlyId?: string;
  onlyRoot?: string;
  apply: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = argv[i + 1];
    if (key === "--owner-id" && next) {
      args.ownerId = next;
      i += 1;
      continue;
    }
    if (key === "--owner-email" && next) {
      args.ownerEmail = next;
      i += 1;
      continue;
    }
    if (key === "--only-id" && next) {
      args.onlyId = next;
      i += 1;
      continue;
    }
    if (key === "--only-root" && next) {
      args.onlyRoot = next;
      i += 1;
      continue;
    }
    if (key === "--apply") {
      args.apply = true;
      continue;
    }
  }
  return args;
}

function usage() {
  console.log(
    [
      "",
      "Workspace owner migration",
      "Usage:",
      "  tsx scripts/migrate-workspaces-owner.ts --owner-id <USER_ID> [--apply]",
      "  tsx scripts/migrate-workspaces-owner.ts --owner-email <EMAIL> [--apply]",
      "",
      "Optional filters:",
      "  --only-id <WORKSPACE_ID>",
      "  --only-root <ROOT_PATH>",
      "",
      "By default this runs in DRY RUN mode. Add --apply to persist changes.",
      "",
    ].join("\n")
  );
}

async function resolveOwnerId(args: Args): Promise<string | null> {
  if (args.ownerId) return args.ownerId;
  if (!args.ownerEmail) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase admin environment variables. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const targetEmail = args.ownerEmail.toLowerCase();
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }
    const users = data?.users ?? [];
    const match = users.find((user) => user.email?.toLowerCase() === targetEmail);
    if (match?.id) return match.id;
    if (users.length < perPage) break;
    page += 1;
  }

  throw new Error(`Supabase user not found for ${args.ownerEmail}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ownerId = await resolveOwnerId(args).catch((error) => {
    console.error("[Workspace Migration] Failed to resolve owner:", error);
    return null;
  });

  if (!ownerId) {
    usage();
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in the environment.");
  }

  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    auth:
      process.env.MONGODB_USER && process.env.MONGODB_PASS
        ? {
            username: process.env.MONGODB_USER,
            password: process.env.MONGODB_PASS,
          }
        : undefined,
  });

  await client.connect();
  const dbName = process.env.MONGODB_DB || "kletron";
  const db = client.db(dbName);
  const collection = db.collection("workspaces");

  const filter: Record<string, unknown> = { ownerId: { $exists: false } };
  if (args.onlyId) {
    if (!ObjectId.isValid(args.onlyId)) {
      throw new Error(`Invalid workspace id: ${args.onlyId}`);
    }
    filter._id = new ObjectId(args.onlyId);
  }
  if (args.onlyRoot) {
    filter.rootPath = path.resolve(args.onlyRoot);
  }

  const candidates = await collection.find(filter).toArray();
  if (candidates.length === 0) {
    console.log("[Workspace Migration] No unowned workspaces found.");
    await client.close();
    return;
  }

  console.log(`[Workspace Migration] Found ${candidates.length} unowned workspace(s).`);
  for (const workspace of candidates) {
    console.log(
      `- ${workspace._id?.toString() ?? "unknown"} :: ${workspace.name ?? "Unnamed"} :: ${workspace.rootPath ?? ""}`
    );
  }

  if (!args.apply) {
    console.log("");
    console.log("[Workspace Migration] DRY RUN: no changes applied.");
    console.log(`Would set ownerId=${ownerId} on ${candidates.length} workspace(s).`);
    await client.close();
    return;
  }

  const result = await collection.updateMany(filter, {
    $set: { ownerId },
  });

  console.log(
    `[Workspace Migration] Updated ${result.modifiedCount} workspace(s) with ownerId=${ownerId}.`
  );
  await client.close();
}

main().catch((error) => {
  console.error("[Workspace Migration] Failed:", error);
  process.exit(1);
});
