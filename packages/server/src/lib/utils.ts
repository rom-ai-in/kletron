import { type ClassValue, clsx } from 'clsx';

/**
 * Utility function for merging class names.
 * Combines clsx for conditional classes.
 */
export function cn(...inputs: ClassValue[]): string {
    return clsx(inputs);
}
