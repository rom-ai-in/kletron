// packages/agent-core/src/categoryPromptEngine.ts

import type { WorkCategoryId, WorkModeId } from '@kletron/shared';
import { DEFAULT_WORK_CATEGORIES, getCategoryById, normalizeToWorkModeId, WORK_MODES } from '@kletron/shared';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptComponent {
  /** The system message */
  systemMessage: string;
  /** The user message template */
  userMessageTemplate: string;
  /** Few-shot examples */
  examples: Array<{ input: string; output: string }>;
  /** Constraints for this category */
  constraints: string[];
}

export interface PromptBuildOptions {
  /** The target category */
  category: WorkCategoryId;
  /** User input */
  userInput: string;
  /** Workspace path */
  workspacePath?: string;
  /** Active files */
  activeFiles?: Array<{ path: string; content: string }>;
  /** Recent file edits */
  recentEdits?: Array<{ path: string; oldContent: string; newContent: string }>;
  /** Custom system prompt override */
  customSystemPrompt?: string;
  /** Available tools for this category */
  availableTools?: string[];
}

// ============================================================================
// CATEGORY PROMPT ENGINE
// ============================================================================

export class CategoryPromptEngine {
  private static instance: CategoryPromptEngine;

  private constructor() {}

  static getInstance(): CategoryPromptEngine {
    if (!CategoryPromptEngine.instance) {
      CategoryPromptEngine.instance = new CategoryPromptEngine();
    }
    return CategoryPromptEngine.instance;
  }

  /**
   * Build a complete prompt for a given category.
   * This is the main entry point for category-aware prompt generation.
   */
  buildPromptForCategory(options: PromptBuildOptions): PromptComponent {
    const { category, userInput, workspacePath, activeFiles, recentEdits, customSystemPrompt, availableTools } = options;
    const mode = normalizeToWorkModeId(String(category));

    // Build system message
    const systemMessage = this.buildSystemMessage(mode, customSystemPrompt, workspacePath, availableTools);

    // Build user message
    const userMessage = this.buildUserMessage(userInput, activeFiles, recentEdits);

    // Get examples
    const examples = this.getCategoryExamples(mode);

    // Get constraints
    const constraints = this.getCategoryConstraints(mode);

    return {
      systemMessage,
      userMessageTemplate: userMessage,
      examples,
      constraints,
    };
  }

  /**
   * Build the system message for a category.
   */
  private buildSystemMessage(
    mode: WorkModeId,
    customPrompt?: string,
    workspacePath?: string,
    availableTools?: string[],
  ): string {
    const baseRole = this.getCategoryRole(mode);
    const capabilities = this.getCategoryCapabilities(mode);

    let message = `You are${baseRole}

`;

    // Add capabilities
    const capabilityList = Object.entries(capabilities)
      .filter(([, enabled]) => enabled)
      .map(([key]) => {
        const label = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (s) => s.toUpperCase());
        return label;
      });

    if (capabilityList.length > 0) {
      message += `**Capabilities:**\n${capabilityList.map((c) => `- ${c}`).join('\n')}\n\n`;
    }

    // Add available tools
    if (availableTools && availableTools.length > 0) {
      message += `**Available Tools:**\n${availableTools.map((t) => `- ${t}`).join('\n')}\n\n`;
    }

    // Add workspace context
    if (workspacePath) {
      message += `**Workspace:** ${workspacePath}\n\n`;
    }

    // Add custom prompt override
    if (customPrompt) {
      message += customPrompt + '\n\n';
    }

    // Add constraints
    const constraints = this.getCategoryConstraints(mode);
    if (constraints.length > 0) {
      message += `**Constraints:**\n${constraints.map((c) => `- ${c}`).join('\n')}\n\n`;
    }

    // Add response guidelines
    message += `**Response Guidelines:**
- Be clear and concise
- Use proper formatting (markdown, code blocks where appropriate)
- Reference specific files and line numbers when applicable
- Ask clarifying questions when needed
- Always respect the workspace boundaries

`;

    return message;
  }

  /**
   * Build the user message with context.
   */
  private buildUserMessage(
    userInput: string,
    activeFiles?: Array<{ path: string; content: string }>,
    recentEdits?: Array<{ path: string; oldContent: string; newContent: string }>,
  ): string {
    let message = userInput;

    // Add active files context
    if (activeFiles && activeFiles.length > 0) {
      const fileContexts = activeFiles
        .slice(0, 3) // Limit to 3 files to avoid context overflow
        .map((f) => {
          const truncatedContent = f.content.length > 2000 ? f.content.substring(0, 2000) + '...' : f.content;
          return `--- ${f.path} ---\n${truncatedContent}\n---\n`;
        })
        .join('\n');

      if (fileContexts) {
        message = `Here is the current context from active files:\n\n${fileContexts}\n\n---\n\nYour task:\n${userInput}`;
      }
    }

    // Add recent edits context
    if (recentEdits && recentEdits.length > 0) {
      const editContext = recentEdits
        .slice(0, 3)
        .map((e) => {
          return `Recent edit to ${e.path}:\n  Old: ${e.oldContent.substring(0, 200)}...\n  New: ${e.newContent.substring(0, 200)}...`;
        })
        .join('\n\n');

      if (editContext) {
        message += `\n\n---\n\nRecent edits in this workspace:\n${editContext}`;
      }
    }

    return message;
  }

  /**
   * Get the role description for a category.
   */
  getCategoryRole(category: WorkCategoryId): string {
    const mode = normalizeToWorkModeId(String(category));
    const roles: Record<WorkModeId, string> = {
      code: ' a senior software engineer specializing in code analysis and generation.',
      work: ' a versatile assistant for research, writing, planning, and general work—without assuming a coding task unless asked.',
    };

    return roles[mode] || ' a helpful AI assistant capable of handling diverse tasks.';
  }

  /**
   * Get the capabilities for a category.
   */
  getCategoryCapabilities(category: WorkCategoryId): Record<string, boolean> {
    const mode = normalizeToWorkModeId(String(category));
    const c = WORK_MODES[mode].capabilities;
    return {
      canEditFiles: !!c.canEditFiles,
      canAccessExternalServices: !!c.canAccessExternalServices,
      canScheduleTasks: !!c.canScheduleTasks,
      canUseTerminal: !!c.canUseTerminal,
    };
  }

  /**
   * Get few-shot examples for a category.
   */
  getCategoryExamples(category: WorkCategoryId): Array<{ input: string; output: string }> {
    const mode = normalizeToWorkModeId(String(category));
    const examples: Record<WorkModeId, Array<{ input: string; output: string }>> = {
      code: [
        {
          input: 'How do I implement authentication?',
          output: 'Here is a secure implementation using JWT:\n\n```typescript\nimport jwt from \'jsonwebtoken\';\n\nexport function generateToken(user: User): string {\n  return jwt.sign(\n    { userId: user.id, email: user.email },\n    process.env.JWT_SECRET,\n    { expiresIn: \'24h\' }\n  );\n}\n```\n\nThis implementation includes:\n1. Proper error handling\n2. Token expiration\n3. Secure secret management',
        },
        {
          input: 'Fix this bug',
          output: 'The issue is in line 42. Here is the corrected version:\n\n```diff\n- const result = data.items.map(item => item.name);\n+ const result = data?.items?.map(item => item.name) || [];\n```\n\nThe fix adds optional chaining to prevent null reference errors.',
        },
      ],
      work: [
        {
          input: 'Write an executive summary for this quarter',
          output: '**Executive summary**\n\nRevenue grew 15% QoQ while churn fell to 3.1%. Engagement metrics improved across core flows. Key risks: dependency on a single channel and hiring lag in support.\n\n**Recommendations:** deepen retention programs, expand top-of-funnel tests, and prioritize onboarding fixes.',
        },
        {
          input: 'What is TypeScript?',
          output: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving your code better structure, improved tooling, and enhanced maintainability. It compiles to plain JavaScript and is widely used in web development.\n\nKey features:\n- Static type checking\n- Type inference\n- Interfaces and generics\n- Modern JavaScript features\n- Excellent IDE support',
        },
      ],
    };

    return examples[mode] || [];
  }

  /**
   * Get constraints for a category.
   */
  getCategoryConstraints(category: WorkCategoryId): string[] {
    const mode = normalizeToWorkModeId(String(category));
    const constraints: Record<WorkModeId, string[]> = {
      code: [
        'Always provide code with proper error handling',
        'Explain complex logic clearly',
        'Suggest appropriate testing strategies',
        'Respect the workspace boundaries',
        'Do not modify files outside the workspace',
      ],
      work: [
        'Maintain a clear, professional tone',
        'Provide accurate information and cite sources when possible',
        'Do not assume a software task unless the user asks',
        'Prefer concise, well-structured answers',
      ],
    };

    return constraints[mode] || [];
  }

  /**
   * Format workspace context for inclusion in prompts.
   */
  formatContextForPrompt(
    context: {
      workspacePath?: string;
      activeFiles?: Array<{ path: string; content: string }>;
      recentEdits?: Array<{ path: string; oldContent: string; newContent: string }>;
      gitBranch?: string;
      gitStatus?: string;
    },
    category: WorkCategoryId,
  ): string {
    const parts: string[] = [];

    if (context.workspacePath) {
      parts.push(`Workspace: ${context.workspacePath}`);
    }

    if (context.gitBranch) {
      parts.push(`Branch: ${context.gitBranch}`);
    }

    if (context.activeFiles && context.activeFiles.length > 0) {
      const fileNames = context.activeFiles.map((f) => f.path).join(', ');
      parts.push(`Active files: ${fileNames}`);
    }

    if (context.gitStatus) {
      parts.push(`Git status: ${context.gitStatus}`);
    }

    if (parts.length === 0) {
      return '';
    }

    return `Context:\n${parts.map((p) => `- ${p}`).join('\n')}\n`;
  }
}

// Singleton instance
export const categoryPromptEngine = CategoryPromptEngine.getInstance();
