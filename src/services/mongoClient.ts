import { MongoClient, Db } from "mongodb";
import { config } from "../config.js";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getMongoClient(): Promise<MongoClient> {
    if (client) {
        return client;
    }

    const uri = config.mongo.uri;
    if (!uri) {
        throw new Error("MONGODB_URI is not configured in environment variables");
    }

    client = new MongoClient(uri, {
        auth:
            config.mongo.user && config.mongo.pass
                ? {
                    username: config.mongo.user,
                    password: config.mongo.pass,
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
    db = mongoClient.db("numezis-coder");
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
