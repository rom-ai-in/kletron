/**
 * One-time migration: copy all data from numezis_coder DB → kletron DB.
 * Run: npx tsx scripts/migrate-db-rename.ts
 */
import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

const uri = process.env.MONGODB_URI ?? "";
const auth = process.env.MONGODB_USER && process.env.MONGODB_PASS
  ? { username: process.env.MONGODB_USER, password: process.env.MONGODB_PASS }
  : undefined;

const SOURCE_DB = "numezis_coder";
const TARGET_DB = "kletron";

async function migrate() {
  console.log("🔌 Connecting to MongoDB Atlas...");
  const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    auth,
  });

  await client.connect();
  console.log("✅ Connected.\n");

  const sourceDb = client.db(SOURCE_DB);
  const targetDb = client.db(TARGET_DB);

  const collections = await sourceDb.listCollections().toArray();
  console.log(`📦 Found ${collections.length} collections in "${SOURCE_DB}":\n`);

  for (const colInfo of collections) {
    const name = colInfo.name;
    const sourceCol = sourceDb.collection(name);
    const targetCol = targetDb.collection(name);

    const count = await sourceCol.countDocuments();
    if (count === 0) {
      console.log(`  ⏭️  ${name}: empty, skipped`);
      continue;
    }

    // Check if target already has data
    const targetCount = await targetCol.countDocuments();
    if (targetCount > 0) {
      console.log(`  ⚠️  ${name}: target already has ${targetCount} docs, dropping first...`);
      await targetCol.drop();
    }

    // Copy docs
    const docs = await sourceCol.find().toArray();
    await targetCol.insertMany(docs);
    console.log(`  ✅ ${name}: ${count} docs migrated`);
  }

  // Copy indexes
  for (const colInfo of collections) {
    const name = colInfo.name;
    const sourceCol = sourceDb.collection(name);
    const indexes = await sourceCol.indexes();
    const customIndexes = indexes.filter((idx: any) => idx.name !== "_id_");

    if (customIndexes.length > 0) {
      const targetCol = targetDb.collection(name);
      for (const idx of customIndexes) {
        try {
          const { key, ...options } = idx;
          delete (options as any).v;
          delete (options as any).ns;
          await targetCol.createIndex(key, options);
        } catch (e: any) {
          if (!e.message?.includes("already exists")) {
            console.log(`  ⚠️  Index ${idx.name} on ${name}: ${e.message}`);
          }
        }
      }
      console.log(`  📑 ${name}: ${customIndexes.length} indexes copied`);
    }
  }

  console.log("\n✅ Migration complete!");
  await client.close();
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
