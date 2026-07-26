import { register as registerCodex } from "./codex";
import { register as registerFrontier } from "./frontier";
import { register as registerGeneric } from "./generic";
import { register as registerLocalSmall } from "./localSmall";

let loaded = false;

/**
 * Registration order does not matter — `resolveHarnessProfile` merges by key
 * specificity, not by insertion order.
 */
export function loadBuiltinHarnessProfiles(): void {
    if (loaded) return;
    loaded = true;
    registerGeneric();
    registerFrontier();
    registerLocalSmall();
    registerCodex();
}

/** Exposed for tests. */
export function resetBuiltinHarnessProfilesLoaded(): void {
    loaded = false;
}
