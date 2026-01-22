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

        const count = await col.countDocuments();
        console.log("Total documents:", count);

        // Try a dummy aggregate to see if $vectorSearch is recognized
        try {
            const results = await col.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: new Array(768).fill(0),
                        numCandidates: 10,
                        limit: 1
                    }
                }
            ]).toArray();
            console.log("Vector search worked! Results:", results.length);
        } catch (err) {
            console.error("Vector search failed:", err.message);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}
run();
