// src/lib/avatar.ts
// Shared identity helpers so the same person renders with the same colour/initials
// in the web sidebar and in the desktop title-bar account chip.

const AVATAR_GRADIENTS = [
    'from-violet-600 to-indigo-600',
    'from-blue-600 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-fuchsia-500 to-purple-500',
    'from-emerald-500 to-teal-600',
    'from-lime-500 to-emerald-500',
] as const;

/** Stable Tailwind gradient class pair derived from a seed (user id, else email). */
export function getAvatarGradient(seed: string): string {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

/** Initials from a full name, falling back to the email local part. */
export function getInitials(name?: string | null, email?: string | null): string {
    if (name) {
        const parts = name.trim().split(/\s+/);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    }
    if (email) {
        const localPart = email.split('@')[0];
        return localPart.slice(0, 2).toUpperCase();
    }
    return 'U';
}
