// packages/server/src/services/migrationRunner.ts
import fs from 'fs';
import path from 'path';

export interface MigrationResult {
    migration: string;
    status: 'success' | 'error' | 'skipped';
    message: string;
    timestamp: Date;
}

/**
 * Database migration runner
 */
export class MigrationRunner {
    private migrationsDir: string;
    private appliedMigrations: Set<string>;

    constructor(migrationsDir: string) {
        this.migrationsDir = migrationsDir;
        this.appliedMigrations = new Set();
    }

    /**
     * Run all pending migrations
     */
    async runAll(): Promise<MigrationResult[]> {
        const results: MigrationResult[] = [];

        try {
            // Load applied migrations
            await this.loadAppliedMigrations();

            // Get migration files
            const migrationFiles = await this.getMigrationFiles();

            // Run each migration
            for (const file of migrationFiles) {
                if (!this.appliedMigrations.has(file)) {
                    const result = await this.runMigration(file);
                    results.push(result);

                    if (result.status === 'success') {
                        this.appliedMigrations.add(file);
                        await this.markAsApplied(file);
                    }
                } else {
                    results.push({
                        migration: file,
                        status: 'skipped',
                        message: 'Already applied',
                        timestamp: new Date()
                    });
                }
            }
        } catch (error) {
            console.error('[MigrationRunner] Error running migrations:', error);
            results.push({
                migration: 'all',
                status: 'error',
                message: (error as Error).message,
                timestamp: new Date()
            });
        }

        return results;
    }

    /**
     * Run a single migration
     */
    private async runMigration(filename: string): Promise<MigrationResult> {
        const filePath = path.join(this.migrationsDir, filename);
        const sql = fs.readFileSync(filePath, 'utf-8');

        try {
            // Execute SQL (in production, use proper database client)
            await this.executeSQL(sql);
            return {
                migration: filename,
                status: 'success',
                message: 'Migration applied successfully',
                timestamp: new Date()
            };
        } catch (error) {
            return {
                migration: filename,
                status: 'error',
                message: (error as Error).message,
                timestamp: new Date()
            };
        }
    }

    /**
     * Load applied migrations from database
     */
    private async loadAppliedMigrations(): Promise<void> {
        try {
            // In production, query the applied migrations table
            // this.appliedMigrations = new Set(await db.query('SELECT migration FROM migrations_applied'));
        } catch (error) {
            console.warn('[MigrationRunner] Could not load applied migrations:', error);
        }
    }

    /**
     * Mark a migration as applied
     */
    private async markAsApplied(filename: string): Promise<void> {
        try {
            // In production, insert into applied migrations table
            // await db.query('INSERT INTO migrations_applied (migration) VALUES (?)', [filename]);
        } catch (error) {
            console.error('[MigrationRunner] Error marking migration as applied:', error);
        }
    }

    /**
     * Get migration files sorted by name
     */
    private async getMigrationFiles(): Promise<string[]> {
        try {
            const files = fs.readdirSync(this.migrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort();
            return files;
        } catch (error) {
            console.error('[MigrationRunner] Error reading migrations directory:', error);
            return [];
        }
    }

    /**
     * Execute SQL statement
     */
    private async executeSQL(sql: string): Promise<void> {
        // In production, use proper database client
        // For now, just log
        console.log('[MigrationRunner] Would execute SQL migration');
        console.log(sql.substring(0, 200) + '...');
    }
}

/**
 * Create a migration runner instance
 */
export function createMigrationRunner(): MigrationRunner {
    const migrationsDir = path.join(__dirname, '../../../config/migrations');
    return new MigrationRunner(migrationsDir);
}

/**
 * Run migrations on server startup
 */
export async function runMigrations(): Promise<MigrationResult[]> {
    const runner = createMigrationRunner();
    const results = await runner.runAll();

    console.log('[MigrationRunner] Migration results:');
    results.forEach(r => {
        console.log(`  ${r.status.toUpperCase()}: ${r.migration} - ${r.message}`);
    });

    return results;
}
