// apps/web/app/api/work-categories/route.ts
import { NextResponse } from "next/server";
import type { WorkCategoryConfig } from "@kletron/shared";

const builtInCategories: WorkCategoryConfig[] = [
  {
    id: "coding",
    name: "Code Assistance",
    description: "AI-powered code analysis, generation and debugging",
    color: "#3B82F6",
    defaultPrompt: "You are a senior software engineer helping with code tasks.",
    availableTools: ["list_files", "read_file", "search_code", "edit_file", "execute_bash", "git_commit"],
    requiredContextTypes: ["repository", "codebase"],
    capabilities: {
      canEditFiles: true,
      canAccessExternalServices: false,
      canScheduleTasks: false
    }
  },
  {
    id: "drafting",
    name: "Document Drafting",
    description: "Create and edit professional documents",
    color: "#10B981",
    defaultPrompt: "You are a professional technical writer.",
    availableTools: ["fetch_url", "web_search", "read_file", "create_document"],
    requiredContextTypes: ["document_template"],
    capabilities: {
      canEditFiles: false,
      canAccessExternalServices: true,
      canScheduleTasks: false
    }
  },
  {
    id: "automation",
    name: "Workflow Automation",
    description: "Create automated workflows and follow-ups",
    color: "#F59E0B",
    defaultPrompt: "You are a productivity automation specialist.",
    availableTools: ["execute_bash", "git_commit", "schedule_task", "create_reminder"],
    requiredContextTypes: ["calendar", "email"],
    capabilities: {
      canEditFiles: true,
      canAccessExternalServices: true,
      canScheduleTasks: true
    }
  },
  {
    id: "general",
    name: "General Assistance",
    description: "Open-ended questions and general help",
    color: "#8B5CF6",
    defaultPrompt: "You are a helpful AI assistant.",
    availableTools: ["web_search", "fetch_url"],
    requiredContextTypes: [],
    capabilities: {
      canEditFiles: false,
      canAccessExternalServices: true,
      canScheduleTasks: false
    }
  }
];

export async function GET() {
  return NextResponse.json(builtInCategories);
}
