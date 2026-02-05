/**
 * File type detection utilities for document viewer routing
 */

const OFFICE_EXTENSIONS = ['.docx', '.doc', '.dotx', '.docm', '.xlsx', '.xls', '.xltx', '.xlsm'];
const WORD_EXTENSIONS = ['.docx', '.doc', '.dotx', '.docm'];
const SPREADSHEET_EXTENSIONS = ['.xlsx', '.xls', '.xltx', '.xlsm'];
const PDF_EXTENSIONS = ['.pdf'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'];


/**
 * Get file extension from path (lowercase)
 */
export function getFileExtension(path: string): string {
    const lastDot = path.lastIndexOf('.');
    if (lastDot === -1) return '';
    return path.slice(lastDot).toLowerCase();
}

/**
 * Check if file is an Office document
 */
export function isOfficeDocument(path: string): boolean {
    return OFFICE_EXTENSIONS.includes(getFileExtension(path));
}

/**
 * Check if file is a Word document
 */
export function isWordDocument(path: string): boolean {
    return WORD_EXTENSIONS.includes(getFileExtension(path));
}

/**
 * Check if file is a spreadsheet
 */
export function isSpreadsheet(path: string): boolean {
    return SPREADSHEET_EXTENSIONS.includes(getFileExtension(path));
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(path: string): boolean {
    return PDF_EXTENSIONS.includes(getFileExtension(path));
}

/**
 * Check if file is an image
 */
export function isImageFile(path: string): boolean {
    return IMAGE_EXTENSIONS.includes(getFileExtension(path));
}

/**
 * Determine viewer type for a file
 */
export type ViewerType = 'monaco' | 'document' | 'image' | 'unsupported';

export function getFileViewerType(path: string): ViewerType {
    if (isOfficeDocument(path) || isPdfFile(path)) {
        return 'document';
    }
    if (isImageFile(path)) {
        return 'image';
    }
    // Default to Monaco for text/code files
    return 'monaco';
}

/**
 * Get MIME type for file extension
 */
export function getMimeType(path: string): string {
    const ext = getFileExtension(path);
    const mimeTypes: Record<string, string> = {
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.dotx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
        '.docm': 'application/vnd.ms-word.document.macroEnabled.12',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.xltx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
