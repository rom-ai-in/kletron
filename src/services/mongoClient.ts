import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
    if (client) {
        return client;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("MONGODB_URI is not configured in environment variables");
    }

    client = new MongoClient(uri, {
        auth:
            process.env.MONGODB_USER && process.env.MONGODB_PASS
                ? {
                    username: process.env.MONGODB_USER,
                    password: process.env.MONGODB_PASS,
                }
                : undefined,
    });

    await client.connect();
    console.log("✓ Connected to MongoDB");
    return client;
}

export async function getDatabase(): Promise<Db> {
    if (db) {
        return db;
    }

    const mongoClient = await getMongoClient();
    db = mongoClient.db("numezis-code");
    return db;
}

export async function closeMongoConnection(): Promise<void> {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log("✓ Closed MongoDB connection");
    }
}
