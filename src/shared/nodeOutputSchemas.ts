import { z } from "zod";

import {
    Phase1OutputSchema,
    Phase2OutputSchema,
    Phase3OutputSchema,
    Phase4OutputSchema,
    Phase5OutputSchema,
    Phase6OutputSchema,
} from "./agentSchemas";

export type NodeOutputSchemaId =
    | "generic_json"
    | "phase1_output"
    | "phase2_output"
    | "phase3_output"
    | "phase4_output"
    | "phase5_output"
    | "phase6_output";

export const GenericJsonObjectSchema = z.record(z.any());

export const nodeOutputSchemaRegistry: Record<NodeOutputSchemaId, z.ZodTypeAny> = {
    generic_json: GenericJsonObjectSchema,
    phase1_output: Phase1OutputSchema,
    phase2_output: Phase2OutputSchema,
    phase3_output: Phase3OutputSchema,
    phase4_output: Phase4OutputSchema,
    phase5_output: Phase5OutputSchema,
    phase6_output: Phase6OutputSchema,
};

export const nodeOutputSchemaOptions: Array<{ id: NodeOutputSchemaId; label: string }> = [
    { id: "generic_json", label: "Generic JSON object" },
    { id: "phase1_output", label: "Phase 1 output" },
    { id: "phase2_output", label: "Phase 2 output" },
    { id: "phase3_output", label: "Phase 3 output" },
    { id: "phase4_output", label: "Phase 4 output" },
    { id: "phase5_output", label: "Phase 5 output" },
    { id: "phase6_output", label: "Phase 6 output" },
];

