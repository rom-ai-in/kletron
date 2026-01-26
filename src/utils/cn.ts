/**
 * Simple utility for class merging
 */
export function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(" ");
}
