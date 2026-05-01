// packages/agent-core/src/categoryPromptEngine.ts

import type { WorkCategoryId } from '@kletron/shared';
import { DEFAULT_WORK_CATEGORIES, getCategoryById } from '@kletron/shared';

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

    // Build system message
    const systemMessage = this.buildSystemMessage(category, customSystemPrompt, workspacePath, availableTools);

    // Build user message
    const userMessage = this.buildUserMessage(userInput, activeFiles, recentEdits);

    // Get examples
    const examples = this.getCategoryExamples(category);

    // Get constraints
    const constraints = this.getCategoryConstraints(category);

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
    category: WorkCategoryId,
    customPrompt?: string,
    workspacePath?: string,
    availableTools?: string[],
  ): string {
    const baseRole = this.getCategoryRole(category);
    const capabilities = this.getCategoryCapabilities(category);

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
    const constraints = this.getCategoryConstraints(category);
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
    const roles: Record<WorkCategoryId, string> = {
      coding: ' a senior software engineer specializing in code analysis and generation.',
      drafting: ' a professional technical writer with expertise in document creation.',
      automation: ' a productivity automation specialist focused on workflow optimization.',
      general: ' a versatile assistant capable of handling diverse tasks.',
    };

    return roles[category] || ' a helpful AI assistant capable of handling diverse tasks.';
  }

  /**
   * Get the capabilities for a category.
   */
  getCategoryCapabilities(category: WorkCategoryId): Record<string, boolean> {
    const capabilities: Record<WorkCategoryId, Record<string, boolean>> = {
      coding: {
        canEditFiles: true,
        canAccessExternalServices: false,
        canScheduleTasks: false,
        canUseTerminal: true,
      },
      drafting: {
        canEditFiles: true,
        canAccessExternalServices: true,
        canScheduleTasks: false,
        canUseTerminal: false,
      },
      automation: {
        canEditFiles: false,
        canAccessExternalServices: true,
        canScheduleTasks: true,
        canUseTerminal: true,
      },
      general: {
        canEditFiles: false,
        canAccessExternalServices: true,
        canScheduleTasks: false,
        canUseTerminal: false,
      },
    };

    return capabilities[category] || { canEditFiles: false, canAccessExternalServices: true, canScheduleTasks: false, canUseTerminal: false };
  }

  /**
   * Get few-shot examples for a category.
   */
  getCategoryExamples(category: WorkCategoryId): Array<{ input: string; output: string }> {
    const examples: Record<WorkCategoryId, Array<{ input: string; output: string }>> = {
      coding: [
        {
          input: 'How do I implement authentication?',
          output: 'Here is a secure implementation using JWT:\n\n```typescript\nimport jwt from \'jsonwebtoken\';\n\nexport function generateToken(user: User): string {\n  return jwt.sign(\n    { userId: user.id, email: user.email },\n    process.env.JWT_SECRET,\n    { expiresIn: \'24h\' }\n  );\n}\n```\n\nThis implementation includes:\n1. Proper error handling\n2. Token expiration\n3. Secure secret management',
        },
        {
          input: 'Fix this bug',
          output: 'The issue is in line 42. Here is the corrected version:\n\n```diff\n- const result = data.items.map(item => item.name);\n+ const result = data?.items?.map(item => item.name) || [];\n```\n\nThe fix adds optional chaining to prevent null reference errors.',
        },
      ],
      drafting: [
        {
          input: 'Write an API documentation',
          output: 'Here is a well-structured API documentation:\n\n## API Documentation\n\n### Endpoints\n\n#### GET /api/users\nReturns a list of users.\n\n**Response:**\n```json\n{\n  "users": [...],\n  "total": 42\n}\n```\n\n#### POST /api/users\nCreates a new user.\n\n**Request Body:**\n```json\n{\n  "name": "John Doe",\n  "email": "john@example.com"\n}\n```\n\n**Response:**\n```json\n{\n  "id": 1,\n  "name": "John Doe",\n  "email": "john@example.com"\n}\n```',
        },
        {
          input: 'Summarize this report',
          output: 'Key findings include:\n\n1. **Revenue growth**: 15% increase quarter-over-quarter\n2. **User engagement**: Daily active users up by 22%\n3. **Churn rate**: Decreased from 4.2% to 3.1%\n\n**Recommendations:**\n- Invest more in user retention programs\n- Expand into new markets\n- Improve onboarding flow',
        },
      ],
      automation: [
        {
          input: 'Create a daily backup automation',
          output: 'Here is a daily backup automation:\n\n```yaml\n# backup.yml\nname: Daily Backup\nschedule: "0 2 * * *"\nsteps:\n  - name: Create backup\n    action: execute_bash\n    args:\n      command: "tar -czf /backups/backup-$(date +%Y%m%d).tar.gz /data"\n  - name: Upload to S3\n    action: upload_s3\n    args:\n      bucket: "my-backup-bucket"\n      key: "backup-$(date +%Y%m%d).tar.gz"\n  - name: Cleanup old backups\n    action: execute_bash\n    args:\n      command: "find /backups -mtime +30 -delete"\n```\n\nThis automation runs daily at 2 AM, backs up data to S3, and cleans up backups older than 30 days.',
        },
      ],
      general: [
        {
          input: 'What is TypeScript?',
          output: 'TypeScript is a strongly typed programming language that builds on JavaScript, giving your code better structure, improved tooling, and enhanced maintainability. It compiles to plain JavaScript and is widely used in web development.\n\nKey features:\n- Static type checking\n- Type inference\n- Interfaces and generics\n- Modern JavaScript features\n- Excellent IDE support',
        },
      ],
    };

    return examples[category] || [];
  }

  /**
   * Get constraints for a category.
   */
  getCategoryConstraints(category: WorkCategoryId): string[] {
    const constraints: Record<WorkCategoryId, string[]> = {
      coding: [
        'Always provide code with proper error handling',
        'Explain complex logic clearly',
        'Suggest appropriate testing strategies',
        'Respect the workspace boundaries',
        'Do not modify files outside the workspace',
      ],
      drafting: [
        'Maintain professional tone',
        'Ensure logical document structure',
        'Cite sources when making claims',
        'Follow standard formatting conventions',
      ],
      automation: [
        'Focus on user\'s specific workflow patterns',
        'Suggest maintainable automation solutions',
        'Consider error handling and recovery scenarios',
        'Minimize external dependencies',
      ],
      general: [
        'Provide accurate information',
        'Cite sources when possible',
        'Be concise but thorough',
        'Acknowledge uncertainty when applicable',
      ],
    };

    return constraints[category] || [];
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
