import { resolveResolvedLlmInfo, type LlmSelection } from "../../llm";
import { loadBuiltinHarnessProfiles } from "./builtins";
import { resolveHarnessProfile as resolveFromRegistry } from "./registry";
import type { HarnessProfile } from "./types";

export type { HarnessProfile } from "./types";
export {
    clearHarnessProfiles,
    harnessProfileCandidateKeys,
    registerHarnessProfile,
    registeredHarnessProfileKeys,
    resolveHarnessProfile as resolveHarnessProfileByKey,
} from "./registry";
export { loadBuiltinHarnessProfiles, resetBuiltinHarnessProfilesLoaded } from "./builtins";

/**
 * Resolves the harness profile for an LLM selection, falling back to the
 * DB-configured provider/model when the selection is partial.
 *
 * Never throws: a run must not fail because profile resolution could not reach
 * the LLM config. An empty profile means "no model-specific tuning", which is
 * the pre-existing behaviour.
 */
export async function resolveHarnessProfileForSelection(
    selection?: Partial<LlmSelection>
): Promise<HarnessProfile> {
    loadBuiltinHarnessProfiles();
    try {
        const info = await resolveResolvedLlmInfo(selection);
        return resolveFromRegistry({ provider: info.provider, model: info.model });
    } catch {
        if (selection?.provider) {
            return resolveFromRegistry({ provider: selection.provider, model: selection.model });
        }
        return {};
    }
}
