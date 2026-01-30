export type PhaseDefinition = {
  id: string;
  label: string;
  summary: string;
  description: string;
  systemPrompt: string;
  toolNames: string[];
};

export type GraphId = string;

export type GraphNodePrompt = {
  id: string;
  label: string;
  prompt: string;
};

// Core file operations and document tools
const baseToolNames = [
  // File operations
  "list_files",
  "read_file",
  "read_file_range",
  "write_file",
  // Document tools
  "list_templates",
  "create_presentation",
  "add_title_slide",
  "add_content_slide",
  "add_slide_by_layout",
  "get_slide_placeholders",
  "set_placeholder_text",
  "add_text_box",
  "add_image_to_slide",
  "list_slides",
  "save_presentation",
  "add_table_slide",
  "list_word_templates",
  "create_document",
  "add_heading",
  "add_paragraph",
  "add_bullet_list",
  "add_table",
  "save_document",
  // Research
  "web_search",
  "fetch_url",
  // Semantic search for working folder
  "semantic_code_search",
  "output_format",
];

const documentToolNames = [
  "list_templates",
  "create_presentation",
  "add_title_slide",
  "add_content_slide",
  "add_slide_by_layout",
  "get_slide_placeholders",
  "set_placeholder_text",
  "add_text_box",
  "add_image_to_slide",
  "list_slides",
  "save_presentation",
  "add_table_slide",
  "list_word_templates",
  "create_document",
  "add_heading",
  "add_paragraph",
  "add_bullet_list",
  "add_table",
  "save_document",
  "web_search",
  "fetch_url",
  "list_files",
  "read_file",
];

export type GraphOption = {
  id: GraphId;
  name: string;
  description: string;
  phases: PhaseDefinition[];
  nodePrompts: GraphNodePrompt[];
  toolNames: string[];
};

export const graphOptions: GraphOption[] = [
  {
    id: "universal-v1",
    name: "Universal Agent",
    description: "Standard agent with access to all registered tools.",
    phases: [
      {
        id: "main",
        label: "Main",
        summary: "Main execution loop",
        description: "The primary interaction loop for the agent.",
        systemPrompt: `You are a professional document and presentation creation assistant with access to powerful MCP tools.

## YOUR PRIMARY CAPABILITIES:
You can CREATE ACTUAL FILES using your tools. When the user asks for a presentation or document, you MUST use the MCP tools to create real .pptx or .docx files.

## PRESENTATION WORKFLOW:
1. Use \`create_presentation\` to initialize a new PowerPoint presentation
2. Use \`add_title_slide\` for the opening slide
3. Use \`add_content_slide\` for content slides with title and body
4. Use \`save_presentation\` to save the file to the working folder

## DOCUMENT WORKFLOW:
1. Use \`create_document\` to initialize a new Word document  
2. Use \`add_heading\` for section headers
3. Use \`add_paragraph\` for body text
4. Use \`add_bullet_list\` for lists
5. Use \`add_table\` for tabular data
6. Use \`save_document\` to save the file

## CRITICAL RULES:
- ALWAYS use the actual MCP tools to create files - do NOT just describe what the presentation would contain
- Save files to the working folder with descriptive names (e.g., "client_proposal.pptx")
- If the user doesn't specify details, ask clarifying questions BEFORE creating
- After creating a document, tell the user the file path where it was saved

## AVAILABLE TOOLS:
- Presentation: create_presentation, add_title_slide, add_content_slide, list_slides, save_presentation
- Documents: create_document, add_heading, add_paragraph, add_bullet_list, add_table, save_document
- File operations: list_files, read_file, write_file
- Research: web_search, fetch_url, semantic_code_search`,
        toolNames: baseToolNames,
      },
    ],
    nodePrompts: [
      {
        id: "main",
        label: "Main",
        prompt: "You are a professional document creation assistant. Use your MCP tools to create actual PowerPoint and Word documents.",
      },
    ],
    toolNames: baseToolNames,
  },
  {
    id: "document-v1",
    name: "Document Generator",
    description: "Agent specialized in creating presentations and documents from templates.",
    phases: [
      {
        id: "analyze",
        label: "Analyze Request",
        summary: "Understanding document requirements",
        description: "Analyzes the user request to determine document type, structure, and content needs.",
        systemPrompt: "You are an expert document specialist. Analyze the user request to determine what type of document (presentation, report, letter) is needed and what content should be included.",
        toolNames: ["web_search", "list_files", "read_file"],
      },
      {
        id: "template",
        label: "Template Selection",
        summary: "Selecting appropriate template",
        description: "Lists and selects the most appropriate template for the document.",
        systemPrompt: "You are a professional designer. Select the best template for the document based on the user's needs and brand requirements.",
        toolNames: ["list_templates", "list_word_templates"],
      },
      {
        id: "create",
        label: "Document Creation",
        summary: "Building the document",
        description: "Creates the document structure using the selected template.",
        systemPrompt: "You are a document creation specialist. Use the MCP tools to create and populate the document with professional content.",
        toolNames: documentToolNames,
      },
      {
        id: "finalize",
        label: "Finalize & Save",
        summary: "Saving final document",
        description: "Reviews and saves the completed document.",
        systemPrompt: "Review the document for completeness and save it to the specified location.",
        toolNames: ["save_presentation", "save_document"],
      },
    ],
    nodePrompts: [
      {
        id: "main",
        label: "Main",
        prompt: "You are a professional document creation assistant. Help users create polished presentations and documents.",
      },
    ],
    toolNames: documentToolNames,
  },
];

export type DeepResearchPhaseKey = "clarify" | "brief" | "plan" | "research" | "summary" | "report";

export const deepResearchPhaseOrder: DeepResearchPhaseKey[] = [
  "clarify",
  "brief",
  "plan",
  "research",
  "summary",
  "report"
];

export const deepResearchPhaseConfig: Record<DeepResearchPhaseKey, PhaseDefinition> = {
  clarify: {
    id: "clarify",
    label: "Clarify Question",
    summary: "Ensuring question clarity",
    description: "Asks the user for clarification if the request is ambiguous.",
    systemPrompt: "You are an expert researcher. Clarify the user request if needed.",
    toolNames: []
  },
  brief: {
    id: "brief",
    label: "Research Brief",
    summary: "Creating research brief",
    description: "Generates a detailed research brief based on the request.",
    systemPrompt: "You are a lead researcher. Create a comprehensive research brief.",
    toolNames: []
  },
  plan: {
    id: "plan",
    label: "Plan Research",
    summary: "Planning research steps",
    description: "Creates a step-by-step plan to execute the research.",
    systemPrompt: "You are a research planner. Break down the brief into actionable steps.",
    toolNames: []
  },
  research: {
    id: "research",
    label: "Researcher",
    summary: "Conducting research",
    description: "Executes specific research tasks using tools.",
    systemPrompt: "You are a code researcher. Use tools to find information.",
    toolNames: baseToolNames
  },
  summary: {
    id: "summary",
    label: "Summarize Findings",
    summary: "Synthesizing findings",
    description: "Aggregates all research findings into a summary.",
    systemPrompt: "Synthesize the gathered information into a coherent summary.",
    toolNames: []
  },
  report: {
    id: "report",
    label: "Action Report",
    summary: "Generating report",
    description: "Creates the final action report.",
    systemPrompt: "Write a final report based on the research findings.",
    toolNames: []
  }
};
