import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function run() {
    const uri = process.env.MONGODB_URI;
    const user = process.env.MONGODB_USER;
    const pass = process.env.MONGODB_PASS;

    if (!uri) {
        console.error("MONGODB_URI not set");
        process.exit(1);
    }

    const client = new MongoClient(uri, {
        auth: user && pass ? { username: user, password: pass } : undefined
    });

    try {
        await client.connect();
        const db = client.db("numezis-coder");
        const col = db.collection("code_vectors");
        const doc = await col.findOne({});
        if (doc && doc.embedding) {
            console.log("Found document with embedding size:", doc.embedding.length);
            console.log("File path:", doc.filePath);
            console.log("Content Hash:", doc.contentHash);
        } else {
            const count = await col.countDocuments();
            console.log("No document found or no embedding field. Total documents:", count);
            if (count > 0) {
                const sample = await col.findOne({});
                console.log("Sample keys:", Object.keys(sample || {}));
            }
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}
run();
