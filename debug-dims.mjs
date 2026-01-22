import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

async function run() {
    const uri = process.env.MONGODB_URI;
    const user = process.env.MONGODB_USER;
    const pass = process.env.MONGODB_PASS;

    const client = new MongoClient(uri, {
        auth: user && pass ? { username: user, password: pass } : undefined
    });

    try {
        await client.connect();
        const db = client.db("numezis-coder");
        const col = db.collection("code_vectors");

        console.log("--- Testing 768 ---");
        try {
            await col.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: new Array(768).fill(0.1),
                        numCandidates: 10,
                        limit: 1
                    }
                }
            ]).toArray();
            console.log("768 worked");
        } catch (err) {
            console.log("768 failed:", err.message);
        }

        console.log("--- Testing 1536 ---");
        try {
            await col.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: new Array(1536).fill(0.1),
                        numCandidates: 10,
                        limit: 1
                    }
                }
            ]).toArray();
            console.log("1536 worked");
        } catch (err) {
            console.log("1536 failed:", err.message);
        }

    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.close();
    }
}
run();
