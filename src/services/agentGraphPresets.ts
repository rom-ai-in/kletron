import type { AgentGraphDefinition, AgentGraphNode } from "./agentGraphTypes";

export const simpleReactPhaseId = "simple_react";
export const simpleReactPhaseLabel = "Agent (ReAct)";
export const simpleReactSystemPrompt = `You are a helpful AI assistant. Use tools to answer the user's question accurately. Focus on the repository context if provided.`;
export const simpleReactToolNames = [
  "list_files", "read_file", "search_code", "repo_metrics", "git_log",
  "describe_structure", "semantic_code_search", "web_search"
];

function promptTemplateForPhase(phaseId: string) {
  switch (phaseId) {
    case "phase1":
      return [
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 1 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase2":
      return [
        "Use Phase 1 output from `state.nodes.phase1` as context.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 2 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase3":
      return [
        "Use target files from `state.nodes.phase2.target_files`.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 3 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase4":
      return [
        "Use raw claims from `state.nodes.phase3.raw_claims`.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 4 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase5":
      return [
        "Use verdicts from `state.nodes.phase4.verdicts` and any prior outputs.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 5 JSON exactly as required by the system prompt.",
      ].join("\n");
    case "phase6":
      return [
        "Use report/tasks from `state.nodes.phase5`.",
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Return the Phase 6 JSON exactly as required by the system prompt.",
      ].join("\n");
    default:
      return ["Current state:", "{{state}}"].join("\n");
  }
}

function schemaIdForPhase(phaseId: string) {
  switch (phaseId) {
    case "phase1":
      return "phase1_output";
    case "phase2":
      return "phase2_output";
    case "phase3":
      return "phase3_output";
    case "phase4":
      return "phase4_output";
    case "phase5":
      return "phase5_output";
    case "phase6":
      return "phase6_output";
    default:
      return "generic_json";
  }
}

const DIAMOND_PHASES = [
  {
    id: "phase1",
    label: "Phase 1 — Reconnaissance",
    toolNames: [
      "list_files", "read_file", "repo_metrics", "git_log", "dependency_info",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: `You are ReconAgent.
Tools available: list_files, read_file, repo_metrics, git_log, dependency_info, describe_structure, semantic_code_search.
Preferred tools: list_files, repo_metrics, git_log, dependency_info, describe_structure, read_file (README/package.json only), semantic_code_search.
Rules:
- You MUST identifying the technical stack, key frameworks, AND architectural hotspots.
- Use 'repo_metrics' to find the most complex files (largest size or diverse languages).
- Use 'git_log' to find 'hotspots' (files with most recent churn).
- Use 'describe_structure' to find entry points.
- Use 'semantic_code_search' to identify core concepts (e.g. 'auth', 'api router').
- Output EXACTLY this JSON object, no prose, no markdown: {"context":{"mission":"...","languages":[],"frameworks":[],"hotspots":[]}}.
- 'hotspots' MUST contain at least 3-5 file paths that look critical or complex based on your recon.
- Do not include ellipses, trailing commas, or extra keys.
- If you cannot populate a field, explain why in the 'mission' string temporarily or use empty arrays, but you should try hard to find them.`
  },
  {
    id: "phase2",
    label: "Phase 2 — Strategy",
    toolNames: [
      "list_files", "read_file", "search_code", "repo_metrics", "git_log",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: `You are StrategistAgent, a Senior Architect.
Mission: select and score the exact files to audit based on the user request.
Tools available: list_files, read_file, search_code, repo_metrics, git_log, describe_structure, semantic_code_search.
Rules:
- You MUST return at least 5-10 target files if the repo is large. Do not be lazy.
- If \`semantic_code_search\` fails or returns empty, use \`search_code\` with keywords (e.g. 'route', 'api', 'controller', 'zod') to find targets.
- Rank files by (Complexity * 0.4) + (Recency * 0.3) + (Relevance * 0.3).
- Assign a focused mission per file (e.g., 'Verify Zod validation for all query params', 'Check for AccessMode bypass').
- Hard cap: use at most 15 tool calls, then output JSON.
- Limit to top 20 files.
- Only output paths that exist in list_files; paths must be repo-relative.
- Output MUST be valid JSON only (no markdown).
- JSON Structure: { "target_files": [ { "path": "string", "focus_area": "string", "score": number } ] }
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase3",
    label: "Phase 3 — Investigation",
    toolNames: ["semantic_code_search"],
    systemPrompt: `You are InvestigatorAgent (Security & Standards Auditor).
Mission: review ONLY the assigned file and emit raw claims backed by EVIDENCE.
Tools available: semantic_code_search.
Rules:
- Your finding MUST be based on the provided file content.
- Use \`semantic_code_search\` to cross-reference (e.g. 'how is ApiError defined?', 'what is the standard utility for X?').
- Do NOT hallucinate standards. If you are unsure, check using the search tool.
- Capture assumptions explicitly (e.g. 'Assumes isValid() returns true without checking DB').
- Output MUST be valid JSON only (no markdown).
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase4",
    label: "Phase 4 — Adjudication",
    toolNames: ["read_file_range", "go_to_definition", "references", "find_references", "semantic_code_search"],
    systemPrompt: `### IDENTITY
You are the **Senior Lead Auditor**. Your purpose is NOT to find new bugs, but to **VERIFY** the claims submitted by junior investigators. You are skeptical, rigorous, and scientific.

Tools available: read_file_range, go_to_definition, references, find_references, semantic_code_search.

### INPUT
You will receive a list of \`RawClaims\`. Each claim posits a potential vulnerability based on a local file observation.
Most claims include an \`assumption\` (e.g., "Variable X is tainted").

### MISSION
For each High/Critical severity claim, you must determine a Verdict using the **Scientific Method**:
1.  **VERIFIED:** You have proven the assumption is TRUE. (e.g., You traced the variable to the API entry point and found NO validation).
2.  **REFUTED:** You have proven the assumption is FALSE. (e.g., You found a \`sanitize()\` function called on the variable in a parent file).
3.  **PLAUSIBLE:** You attempted verification but hit a dead end (e.g., dynamic interface injection) or ran out of steps. The risk remains.
4.  **REJECTED:** The claim is trivial, a false positive, or logically unsound.

### PROTOCOL
For each claim:
1.  **Analyze the Assumption:** What *must* be true for this to be a valid bug?
2.  **Plan the Trace:** Which symbols do you need to follow? (e.g., "I need to find usages of \`processUserData\` to see where the input comes from").
3.  **Execute Tools:** Use \`find_references\` or \`go_to_definition\`.
    * *Constraint:* You have a maximum of **3 HOPS** per claim. Do not go down infinite rabbit holes.
    * *Constraint:* Do NOT re-read the original file's full content. Trust the snippet. Look OUTSIDE.
4.  **Final Verdict:** Decide based on evidence.

### OUTPUT FORMAT
Return a JSON object:
{
  "verdicts": [
    {
      "claim_id": "c_123",
      "status": "VERIFIED",
      "confidence_score": 95,
      "reasoning": "Traced \`userId\` parameter from \`updateProfile\` (line 40) back to \`routes.ts\` (line 15). The route uses \`express.json()\` but applies no Zod/Joi validation schema before passing data to the controller.",
      "proof_trace": ["routes.ts:15 (Entry)", "controller.ts:20 (Pass-through)", "service.ts:40 (Usage)"]
    }
  ]
}

Rules:
- Output MUST be valid JSON only (no markdown).
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase5",
    label: "Phase 5 — Reporting",
    toolNames: [
      "list_files", "read_file", "repo_metrics", "git_log", "dependency_info",
      "describe_structure", "semantic_code_search"
    ],
    systemPrompt: `You are ReporterAgent.
Mission: synthesize verified findings into a final report + tasks.
Tools available: list_files, read_file, repo_metrics, git_log, dependency_info, describe_structure, semantic_code_search.
Rules:
- Discard REJECTED findings, cluster themes, prioritize by severity/confidence.
- Output MUST be valid JSON only (no markdown outside JSON string).
- Do not use ellipses (...) or trailing commas; output strict JSON.`
  },
  {
    id: "phase6",
    label: "Phase 6 — Actionable Next Steps",
    toolNames: [],
    systemPrompt: `You are the NextStepsAgent.
Mission: Based on the verified findings and report, generate a concrete list of next steps.
Rules:
- Focus on high-priority items first.
- Make steps actionable (e.g., 'Refactor X to handle Y').
- Classify steps by type (fix, test, refactor, process).
- Output strict JSON matching the schema.
- Do not use prose or markdown outside the JSON.`
  }
];

export function buildDiamondFlowAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = DIAMOND_PHASES.map((phase) => {
    return {
      id: phase.id,
      label: phase.label,
      react: {
        systemPrompt: phase.systemPrompt,
        userPromptTemplate: promptTemplateForPhase(phase.id),
        toolNames: phase.toolNames,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: schemaIdForPhase(phase.id) },
    };
  });

  const edges = DIAMOND_PHASES.slice(1).map((phase, idx) => {
    const source = DIAMOND_PHASES[idx].id;
    const target = phase.id;
    return {
      id: `edge-${source}-${target}`,
      source,
      target,
    };
  });

  return {
    name: "Diamond flow (agent graph)",
    description: "Diamond flow implemented as a DAG of ReAct nodes (phase1..phase6).",
    nodes,
    edges,
  };
}


export function buildSimpleReactAgentGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = [
    {
      id: simpleReactPhaseId,
      label: simpleReactPhaseLabel,
      react: {
        systemPrompt: simpleReactSystemPrompt,
        userPromptTemplate: [
          "Mission / question is in `state.mission`.",
          "Current state:",
          "{{state}}",
          "",
          "Answer by outputting a strict JSON object (generic JSON).",
        ].join("\n"),
        toolNames: simpleReactToolNames,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json" },
    },
  ];

  return {
    name: "Simple ReAct (agent graph)",
    description: "Single-node ReAct agent graph (equivalent to the hard-coded simple ReAct workflow).",
    nodes,
    edges: [],
  };
}


// ─────────────────────────────────────────────────────────────────────────────
// PRESENTATION GENERATOR PRO GRAPH
// 6-phase pipeline: research → offer_analysis → structure → enrich → create → verify
// ─────────────────────────────────────────────────────────────────────────────

const PRESENTATION_GEN_PHASES = [
  {
    id: "research",
    label: "Client Research",
    toolNames: ["web_search", "fetch_url"],
    systemPrompt: `You are a Client Research Specialist.

## MISSION
Gather comprehensive information about the client mentioned in the user's request.

## REQUIRED DATA TO COLLECT
1. **Company name** (official name)
2. **Headquarters** (city, country)
3. **Employee count** (approximate)
4. **Industry** (sector/vertical)
5. **Recent news** (last 2-3 headlines from 2024-2025)
6. **Key contacts** (CEO, CFO, HR Director if available)

## TOOLS
- Use \`web_search\` for initial discovery (company info, news)
- Use \`fetch_url\` to gather details from official pages (if allowed)

## OUTPUT FORMAT
Return strict JSON:
{
  "company_name": "...",
  "headquarters": "...",
  "employee_count": "...",
  "industry": "...",
  "recent_news": ["headline1", "headline2"],
  "key_contacts": ["Name — Role", ...],
  "summary": "Brief 2-sentence company description"
}`
  },
  {
    id: "offer_analysis",
    label: "Offer Analysis",
    toolNames: ["list_files", "read_file"],
    systemPrompt: `You are a Proposal Standards Analyst.

## MISSION
Analyze existing example offers in the working folder to understand structure and messaging patterns.

## STEPS
1. Use \`list_files\` to find files in "Example offers/" or similar directories
2. Use \`read_file\` to extract content from 1-3 example proposals
3. Identify common sections, slide patterns, and key messaging

## OUTPUT FORMAT
Return strict JSON:
{
  "analyzed_files": ["path1", "path2"],
  "common_sections": ["Cover", "Agenda", "Understanding", ...],
  "slide_patterns": ["Numbered sections", "Team slides with photos", ...],
  "key_messaging": ["Compliance focus", "Swiss expertise", ...],
  "summary": "Brief summary of the standard proposal structure"
}`
  },
  {
    id: "structure_planning",
    label: "Structure Planning",
    toolNames: [],
    systemPrompt: `You are a Presentation Architect.

## MISSION
Design the slide-by-slide structure for the client proposal.

## CONTEXT
- Research findings are in \`state.nodes.research\`
- Example offer patterns are in \`state.nodes.offer_analysis\`

## RULES
1. Follow the common section patterns identified in offer analysis
2. Plan 8-12 slides for a typical proposal
3. For each slide, specify: number, title, type (title/content/table), key points

## OUTPUT FORMAT
Return strict JSON:
{
  "total_slides": 10,
  "slides": [
    { "number": 1, "title": "...", "type": "title", "key_points": ["..."] },
    { "number": 2, "title": "Agenda", "type": "content", "key_points": ["..."] },
    ...
  ],
  "summary": "Brief rationale for structure"
}`
  },
  {
    id: "enrich",
    label: "Content Enrichment",
    toolNames: [],
    systemPrompt: `You are a Content Personalization Specialist.

## MISSION
Enrich the planned slide structure with client-specific data from research.

## CONTEXT
- Client research: \`state.nodes.research\`
- Slide structure: \`state.nodes.structure_planning\`

## MANDATORY RULES
1. For EVERY content slide, include at least ONE specific fact from research:
   - Employee count or company size
   - Recent news or milestone
   - Key contact names
   - Industry-specific compliance needs
2. Replace generic phrases like "your organization" with specific client data
3. Add concrete numbers and names wherever possible

## OUTPUT FORMAT
Return strict JSON:
{
  "enriched_slides": [
    {
      "number": 1,
      "title": "...",
      "type": "title|content|table",
      "content": "Bullet points with client-specific data woven in",
      "research_facts_used": ["employee_count", "recent_news"]
    },
    ...
  ],
  "personalization_metrics": {
    "total_slides": 10,
    "slides_with_research_data": 8,
    "facts_used": ["company_name", "employee_count", "key_contacts", ...]
  }
}`
  },
  {
    id: "create_slides",
    label: "Create Slides",
    toolNames: [
      "list_templates",
      "create_presentation",
      "slide_loop_controller",
      "list_slides",
      "save_presentation"
    ],
    systemPrompt: `You are a Presentation Builder.

## MISSION
Create the actual PowerPoint presentation using the slide_loop_controller for intelligent template selection.

## CONTEXT
- Enriched slides with content: \`state.nodes.enrich.enriched_slides\`
- Client research: \`state.nodes.research\`

## WORKFLOW
1. Use \`list_templates\` to confirm the template is available
2. Use \`create_presentation\` with "ForvisMazars_Template_BLANK_012026" template
3. Use \`slide_loop_controller\` with the enriched_slides array - it will:
   - Automatically detect each slide type (title, section, content, table, etc.)
   - Select the appropriate template layout for each slide
   - Inject content into the correct placeholders
4. Use \`save_presentation\` with FULL PATH to Outputs folder

## TEMPLATE MAPPING (handled by slide_loop_controller)
The controller automatically maps slide types to templates:
- title/cover → Template Slide 3 (cover page)
- section/divider/chapter → Template Slide 5-6 (section dividers)
- content/bullets/text → Template Slide 7 (standard content with bullets)
- two_column/comparison → Template Slide 10 (two-column layout)
- table/data → Template Slide 11-12 (table layouts)
- contact/thankyou/close → Template Slide 17-20 (closing slides)

## CRITICAL: OUTPUT PATH
Save all presentations to: /Users/romainmagnin/Desktop/payroll-working-folder/Outputs/
Example: /Users/romainmagnin/Desktop/payroll-working-folder/Outputs/{ClientName}_Proposal_{YYYY-MM-DD}.pptx

## FILENAME CONVENTION
Use: {ClientName}_Proposal_{YYYY-MM-DD}.pptx
Replace spaces with underscores in ClientName

## OUTPUT FORMAT
Return strict JSON:
{
  "slides_created": 10,
  "template_used": "ForvisMazars_Template_BLANK_012026",
  "output_file": "/Users/romainmagnin/Desktop/payroll-working-folder/Outputs/ClientName_Proposal_YYYY-MM-DD.pptx",
  "slide_mapping": { "1": {"type": "title", "template": 3}, "2": {"type": "content", "template": 7} },
  "success": true,
  "summary": "Brief description of what was created"
}`
  },
  {
    id: "verify",
    label: "Verify Output",
    toolNames: ["list_files", "read_file"],
    systemPrompt: `You are a Quality Assurance Specialist.

## MISSION
Verify the generated presentation and compute a personalization score.

## CONTEXT
- Created file path: \`state.nodes.create_slides.output_file\`
- Research data used: \`state.nodes.research\`
- Enrichment metrics: \`state.nodes.enrich.personalization_metrics\`

## VERIFICATION STEPS
1. Use \`list_files\` to confirm the output file exists
2. Use \`read_file\` to extract text content from the generated .pptx
3. Count how many research facts appear in the actual content:
   - Company name mentioned?
   - Employee count mentioned?
   - Key contact names mentioned?
   - Recent news/milestones mentioned?

## PERSONALIZATION SCORE
Calculate: (facts found in output) / (total facts from research) × 100

## OUTPUT FORMAT
Return strict JSON:
{
  "file_exists": true,
  "file_path": "...",
  "file_verified": true,
  "personalization_score": 75,
  "facts_found": ["company_name", "employee_count"],
  "facts_missing": ["key_contacts"],
  "recommendations": ["Add key contact names to team slide"],
  "status": "success",
  "message": "Presentation verified with 75% personalization score"
}`
  }
];

function presentationGenPromptTemplate(phaseId: string) {
  switch (phaseId) {
    case "research":
      return [
        "Mission is in `state.mission`.",
        "Current state:",
        "{{state}}",
        "",
        "Gather client research and return strict JSON as specified."
      ].join("\n");
    case "offer_analysis":
      return [
        "Mission is in `state.mission`.",
        "Working folder for examples is in the MCP context.",
        "Current state:",
        "{{state}}",
        "",
        "Analyze example offers and return strict JSON."
      ].join("\n");
    case "structure_planning":
      return [
        "Mission is in `state.mission`.",
        "Research data: `state.nodes.research`",
        "Offer patterns: `state.nodes.offer_analysis`",
        "Current state:",
        "{{state}}",
        "",
        "Plan the slide structure and return strict JSON."
      ].join("\n");
    case "enrich":
      return [
        "Mission is in `state.mission`.",
        "",
        "## CLIENT RESEARCH DATA (MANDATORY TO USE)",
        "Company: {{state.nodes.research.company_name}}",
        "Employees: {{state.nodes.research.employee_count}}",
        "Headquarters: {{state.nodes.research.headquarters}}",
        "Industry: {{state.nodes.research.industry}}",
        "Recent News: {{state.nodes.research.recent_news}}",
        "Key Contacts: {{state.nodes.research.key_contacts}}",
        "",
        "## SLIDE STRUCTURE",
        "{{state.nodes.structure_planning.slides}}",
        "",
        "Current state:",
        "{{state}}",
        "",
        "Enrich each slide with specific client data. Return strict JSON."
      ].join("\n");
    case "create_slides":
      return [
        "Mission is in `state.mission`.",
        "",
        "## ENRICHED SLIDES TO CREATE",
        "{{state.nodes.enrich.enriched_slides}}",
        "",
        "## CLIENT INFO",
        "Company: {{state.nodes.research.company_name}}",
        "Location: {{state.nodes.research.headquarters}}",
        "",
        "Current state:",
        "{{state}}",
        "",
        "Create the presentation using MCP tools. Return strict JSON."
      ].join("\n");
    case "verify":
      return [
        "Mission is in `state.mission`.",
        "",
        "## OUTPUT FILE",
        "Path: {{state.nodes.create_slides.output_file}}",
        "",
        "## RESEARCH FACTS TO CHECK FOR",
        "Company: {{state.nodes.research.company_name}}",
        "Employees: {{state.nodes.research.employee_count}}",
        "Contacts: {{state.nodes.research.key_contacts}}",
        "News: {{state.nodes.research.recent_news}}",
        "",
        "Current state:",
        "{{state}}",
        "",
        "Verify the output and compute personalization score. Return strict JSON."
      ].join("\n");
    default:
      return ["Current state:", "{{state}}"].join("\n");
  }
}

export function buildPresentationGeneratorProGraph(): Omit<AgentGraphDefinition, "_id" | "createdAt" | "updatedAt"> {
  const nodes: AgentGraphNode[] = PRESENTATION_GEN_PHASES.map((phase) => {
    return {
      id: phase.id,
      label: phase.label,
      react: {
        systemPrompt: phase.systemPrompt,
        userPromptTemplate: presentationGenPromptTemplate(phase.id),
        toolNames: phase.toolNames,
        llmSelection: { provider: "azure" },
      },
      output: { schemaId: "generic_json" },
    };
  });

  const edges = PRESENTATION_GEN_PHASES.slice(1).map((phase, idx) => {
    const source = PRESENTATION_GEN_PHASES[idx].id;
    const target = phase.id;
    return {
      id: `edge-${source}-${target}`,
      source,
      target,
    };
  });

  return {
    name: "Presentation Generator Pro",
    description: "6-phase pipeline for creating personalized client proposals with research injection, content enrichment, and quality verification.",
    nodes,
    edges,
  };
}
