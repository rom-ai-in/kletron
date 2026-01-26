
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { AgentEvent } from "../../types";

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || "";
// Determine the brain directory - using a fixed path for now relative to the known structure or configurable
// In the context of the agent, we are writing to <appDataDir>/brain/conversations
// We'll trust the caller to provide the base path or default to the standard location
const BRAIN_DIR = path.join(HOME_DIR, ".gemini", "antigravity", "brain", "conversations");

export type ConversationMetadata = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    status: "active" | "archived";
    summary?: string;
};

export type Conversation = ConversationMetadata & {
    messages: AgentEvent[];
};

export class ConversationService {
    private baseDir: string;

    constructor(baseDir?: string) {
        this.baseDir = baseDir || BRAIN_DIR;
    }

    async initialize() {
        await fs.mkdir(this.baseDir, { recursive: true });
        await fs.mkdir(path.join(this.baseDir, "archive"), { recursive: true });
    }

    async create(title: string): Promise<Conversation> {
        await this.initialize();
        const id = uuidv4();
        const now = new Date().toISOString();

        const conversation: Conversation = {
            id,
            title,
            createdAt: now,
            updatedAt: now,
            status: "active",
            messages: []
        };

        await this.save(conversation);
        return conversation;
    }

    async list(): Promise<ConversationMetadata[]> {
        await this.initialize();
        const conversations: ConversationMetadata[] = [];

        // Helper to read dir
        const scanDir = async (dir: string, isArchive: boolean) => {
            try {
                const files = await fs.readdir(dir);
                for (const file of files) {
                    if (file.endsWith(".json")) {
                        try {
                            const content = await fs.readFile(path.join(dir, file), "utf-8");
                            const data = JSON.parse(content);
                            const { messages, ...metadata } = data;
                            // Ensure status matches location
                            metadata.status = isArchive ? "archived" : "active";
                            // Basic inference of activity state from last message
                            // We attach a transient field 'lastRole' for frontend to decide 'working' vs 'stopped'
                            if (messages && messages.length > 0) {
                                (metadata as any).lastRole = messages[messages.length - 1].role;
                            }
                            conversations.push(metadata);
                        } catch (err) {
                            console.error(`Failed to read conversation ${file}`, err);
                        }
                    }
                }
            } catch (e) { /* ignore if dir missing */ }
        };

        await scanDir(this.baseDir, false);
        await scanDir(path.join(this.baseDir, "archive"), true);

        return conversations.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }

    async get(id: string): Promise<Conversation | null> {
        const filePath = path.join(this.baseDir, `${id}.json`);
        try {
            const content = await fs.readFile(filePath, "utf-8");
            return JSON.parse(content);
        } catch {
            // Try archive
            const archivePath = path.join(this.baseDir, "archive", `${id}.json`);
            try {
                const content = await fs.readFile(archivePath, "utf-8");
                return JSON.parse(content);
            } catch {
                return null;
            }
        }
    }

    async save(conversation: Conversation): Promise<void> {
        await this.initialize();
        conversation.updatedAt = new Date().toISOString();
        const filePath = conversation.status === "archived"
            ? path.join(this.baseDir, "archive", `${conversation.id}.json`)
            : path.join(this.baseDir, `${conversation.id}.json`);

        await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
    }

    async appendEvent(id: string, event: AgentEvent): Promise<void> {
        const conversation = await this.get(id);
        if (!conversation) throw new Error("Conversation not found");

        conversation.messages.push(event);
        await this.save(conversation);
    }

    async archive(id: string): Promise<void> {
        const conversation = await this.get(id);
        if (!conversation) throw new Error("Conversation not found");

        // Remove from active
        const activePath = path.join(this.baseDir, `${id}.json`);
        try {
            await fs.unlink(activePath);
        } catch { }

        conversation.status = "archived";
        await this.save(conversation);
    }
}
