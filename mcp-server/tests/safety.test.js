import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../tools/pathUtils.js', () => ({
    resolveRepoPath: vi.fn(),
    ensurePathInside: vi.fn(),
}));

// Import implementations
import { writeFile } from '../tools/writeFile.js';
import * as pathUtils from '../tools/pathUtils.js';

describe('writeFile Safety', () => {
    const mockRepoRoot = '/repo';

    beforeEach(() => {
        vi.resetAllMocks();
        pathUtils.resolveRepoPath.mockReturnValue(mockRepoRoot);
        // Default ensurePathInside passes
        pathUtils.ensurePathInside.mockImplementation(() => { });
    });

    it('blocks dotfiles', async () => {
        const filePath = '.secret';
        const content = 'secret';

        await expect(writeFile.run({ repoPath: mockRepoRoot, filePath, content }))
            .rejects.toThrow(/Security: Writing to dotfiles is blocked/);
    });

    it('blocks sensitive filenames', async () => {
        const filePath = 'package-lock.json';
        const content = '{}';

        await expect(writeFile.run({ repoPath: mockRepoRoot, filePath, content }))
            .rejects.toThrow(/Security: Writing to sensitive file/);
    });

    it('blocks blocked extensions', async () => {
        const filePath = 'evil.env'; // Extension .env
        const content = '...';

        await expect(writeFile.run({ repoPath: mockRepoRoot, filePath, content }))
            .rejects.toThrow(/Security: Writing to file type '.env' is blocked/);
    });

    it('blocks large files', async () => {
        const filePath = 'large.txt';
        const content = 'a'.repeat(256 * 1024 + 10); // > 256KB

        await expect(writeFile.run({ repoPath: mockRepoRoot, filePath, content }))
            .rejects.toThrow(/Security: File content exceeds maximum/);
    });

    it('writes valid file', async () => {
        const filePath = 'docs/notes.md';
        const content = '# Notes';
        fs.mkdir.mockResolvedValue(undefined);
        fs.writeFile.mockResolvedValue(undefined);

        const result = await writeFile.run({ repoPath: mockRepoRoot, filePath, content });
        expect(result).toHaveProperty('ok', true);
        expect(fs.writeFile).toHaveBeenCalled();
    });
});
