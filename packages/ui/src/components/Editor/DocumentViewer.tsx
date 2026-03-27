"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { FileText, FileSpreadsheet, AlertCircle, Download, Loader2 } from 'lucide-react';
import { isWordDocument, isSpreadsheet } from '@kletron/shared/utils/fileTypes';

interface DocumentViewerProps {
    filePath: string;
}

/**
 * Document viewer component for Office files (docx, xlsx, pdf)
 * Uses mammoth.js for Word documents and provides download fallback for others
 */
export const DocumentViewer: React.FC<DocumentViewerProps> = ({ filePath }) => {
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const documentUrl = useMemo(() =>
        `/api/fs/document?path=${encodeURIComponent(filePath)}`,
        [filePath]
    );

    // Get file type icon
    const FileIcon = useMemo(() => {
        if (isWordDocument(filePath)) return FileText;
        if (isSpreadsheet(filePath)) return FileSpreadsheet;
        return FileText;
    }, [filePath]);

    const fileName = filePath.split('/').pop() || 'Document';
    useEffect(() => {
        let cancelled = false;

        const loadDocument = async () => {
            setLoading(true);
            setError(null);
            setContent('');

            try {
                // Fetch the binary document
                const response = await fetch(documentUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load document: ${response.statusText}`);
                }

                const arrayBuffer = await response.arrayBuffer();

                // For Word documents, use mammoth.js to convert to HTML
                if (isWordDocument(filePath)) {
                    const mammoth = await import('mammoth');
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (!cancelled) {
                        setContent(result.value);
                        if (result.messages.length > 0) {
                            console.log('Mammoth messages:', result.messages);
                        }
                    }
                } else {
                    // For other document types, show info
                    if (!cancelled) {
                        const sizeKB = Math.round(arrayBuffer.byteLength / 1024);
                        setContent(`
                            <div class="doc-info">
                                <p><strong>File:</strong> ${fileName}</p>
                                <p><strong>Size:</strong> ${sizeKB} KB</p>
                                <p class="note">Inline preview not available for this file type. Click the download button to view.</p>
                            </div>
                        `);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load document');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        loadDocument();

        return () => {
            cancelled = true;
        };
    }, [filePath, documentUrl, fileName]);

    return (
        <div className="h-full w-full flex flex-col bg-bg-app">
            {/* Header with file info */}
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-bg-surface border-b border-border-subtle">
                <div className="flex items-center gap-2 min-w-0">
                    <FileIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                    <span className="text-sm text-text-secondary truncate">{fileName}</span>
                </div>
                <a
                    href={documentUrl}
                    download={fileName}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-status-success hover:bg-status-success text-text-primary rounded text-xs transition-colors flex-shrink-0"
                >
                    <Download className="w-3 h-3" />
                    Download
                </a>
            </div>

            {/* Document content */}
            <div className="flex-1 min-h-0 overflow-auto">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-text-muted">
                        <Loader2 className="w-8 h-8 animate-spin mb-3" />
                        <p className="text-sm">Loading document...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex flex-col items-center justify-center text-text-muted p-4">
                        <AlertCircle className="w-8 h-8 mb-3 text-status-error-text" />
                        <p className="text-sm text-status-error-text text-center max-w-md">{error}</p>
                    </div>
                ) : (
                    <div
                        className="document-content p-6 prose prose-invert prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: content }}
                    />
                )}
            </div>

            {/* Styles for document content */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .document-content {
                    background: var(--color-bg-app);
                    color: var(--color-text-primary);
                }
                .document-content h1,
                .document-content h2,
                .document-content h3,
                .document-content h4 {
                    color: var(--color-text-primary);
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                }
                .document-content p {
                    margin: 0.75em 0;
                    line-height: 1.6;
                }
                .document-content table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 1em 0;
                }
                .document-content th,
                .document-content td {
                    border: 1px solid var(--color-border-subtle);
                    padding: 0.5em 0.75em;
                    text-align: left;
                }
                .document-content th {
                    background: var(--color-bg-surface);
                    font-weight: 600;
                }
                .document-content ul,
                .document-content ol {
                    margin: 0.75em 0;
                    padding-left: 1.5em;
                }
                .document-content li {
                    margin: 0.35em 0;
                }
                .document-content img {
                    max-width: 100%;
                    height: auto;
                    border-radius: 4px;
                    margin: 1em 0;
                }
                .doc-info {
                    text-align: center;
                    padding: 3rem;
                }
                .doc-info h2 {
                    font-size: 1.5rem;
                    margin-bottom: 1rem;
                }
                .doc-info .note {
                    color: var(--color-text-muted);
                    font-style: italic;
                    margin-top: 1.5rem;
                }
            ` }} />
        </div>
    );
};

export default DocumentViewer;
