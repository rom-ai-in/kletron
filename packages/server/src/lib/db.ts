import { MongoClient, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.MONGODB_URI) {
    console.warn("⚠️ MONGODB_URI is not defined in the environment variables.");
}

const uri = process.env.MONGODB_URI ?? "";
const options = {
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
};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient> | undefined;
let loggedConnectError = false;

if (process.env.MONGODB_URI) {
    if (process.env.NODE_ENV === "development") {
        // In development mode, use a global variable so that the value
        // is preserved across module reloads caused by HMR (Hot Module Replacement).
        const globalWithMongo = global as typeof globalThis & {
            _mongoClientPromise?: Promise<MongoClient>;
        };

        if (!globalWithMongo._mongoClientPromise) {
            client = new MongoClient(uri, options);
            globalWithMongo._mongoClientPromise = client.connect().catch((error) => {
                if (!loggedConnectError) {
                    loggedConnectError = true;
                    console.error("MongoDB connection failed:", error);
                }
                throw error;
            });
        }
        clientPromise = globalWithMongo._mongoClientPromise;
    } else {
        // In production mode, it's best to not use a global variable.
        client = new MongoClient(uri, options);
        clientPromise = client.connect().catch((error) => {
            if (!loggedConnectError) {
                loggedConnectError = true;
                console.error("MongoDB connection failed:", error);
            }
            throw error;
        });
    }
}

export async function getDb(dbName?: string) {
    if (!clientPromise) {
        throw new Error("MongoDB client is not initialized (missing MONGODB_URI?)");
    }
    const connectedClient = await clientPromise;
    const defaultDb =
        process.env.MONGODB_DB ||
        process.env.MONGODB_DB_NAME ||
        "numezis_coder";
    return connectedClient.db(dbName || defaultDb); // Default DB name if not specified
}

export async function closeDb() {
    if (client) {
        await client.close();
    }
}

/**
 * Get the connected MongoClient instance.
 * Useful for services that need the raw client (e.g. LangGraph checkpoint saver).
 */
export async function getMongoClient(): Promise<MongoClient> {
    if (!clientPromise) {
        throw new Error("MongoDB client is not initialized (missing MONGODB_URI?)");
    }
    return await clientPromise;
}

// Aliases for backward compatibility with services migrating from mongoClient.ts
export const getDatabase = getDb;
export const closeMongoConnection = closeDb;
