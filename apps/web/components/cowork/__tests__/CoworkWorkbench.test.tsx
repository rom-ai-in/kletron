// apps/web/components/cowork/__tests__/CoworkWorkbench.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CoworkWorkbench } from '../CoworkWorkbench';
import { CoworkProvider } from '../../context/CoworkContext';

// Mock fetch
global.fetch = vi.fn();

describe('CoworkWorkbench', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as any).mockResolvedValue({
            ok: true,
            body: { getReader: () => null }
        });
    });

    it('should render the workbench', () => {
        render(
            <CoworkProvider workspaceId="test-workspace">
                <CoworkWorkbench workspaceId="test-workspace" />
            </CoworkProvider>
        );

        expect(screen.getByText(/workbench/i)).toBeInTheDocument();
    });

    it('should display current category', () => {
        render(
            <CoworkProvider workspaceId="test-workspace">
                <CoworkWorkbench workspaceId="test-workspace" initialCategory="coding" />
            </CoworkProvider>
        );

        expect(screen.getByText(/code assistance/i)).toBeInTheDocument();
    });

    it('should switch categories', async () => {
        render(
            <CoworkProvider workspaceId="test-workspace">
                <CoworkWorkbench workspaceId="test-workspace" initialCategory="coding" />
            </CoworkProvider>
        );

        // Find category selector
        const selector = screen.getByRole('button', { name: /select category/i }) as HTMLButtonElement;
        fireEvent.click(selector);

        // Select drafting category
        const draftingOption = screen.getByText(/document drafting/i);
        fireEvent.click(draftingOption);

        await waitFor(() => {
            expect(screen.getByText(/document drafting/i)).toBeInTheDocument();
        });
    });

    it('should send messages', async () => {
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            body: { getReader: () => null }
        });

        render(
            <CoworkProvider workspaceId="test-workspace">
                <CoworkWorkbench workspaceId="test-workspace" initialCategory="coding" />
            </CoworkProvider>
        );

        const input = screen.getByPlaceholderText(/ask about code/i) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: 'How do I implement authentication?' } });
        fireEvent.click(screen.getByRole('button', { name: /send/i }));

        await waitFor(() => {
            expect(screen.getByText('How do I implement authentication?')).toBeInTheDocument();
        });
    });

    it('should show loading state', () => {
        (global.fetch as any).mockImplementation(() => new Promise(() => {}));

        render(
            <CoworkProvider workspaceId="test-workspace">
                <CoworkWorkbench workspaceId="test-workspace" initialCategory="coding" />
            </CoworkProvider>
        );

        const input = screen.getByPlaceholderText(/ask about code/i) as HTMLTextAreaElement;
        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.click(screen.getByRole('button', { name: /send/i }));

        expect(screen.getByText(/loading/i) || screen.queryByRole('status')).toBeInTheDocument();
    });
});
