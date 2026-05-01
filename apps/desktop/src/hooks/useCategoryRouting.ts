import { useMemo } from "react";

// Define the available tools for each category
const CATEGORY_TOOLS = {
  coding: ["list_files", "read_file", "search_code", "execute_bash", "git_commit", "git_push"],
  general: ["web_search", "fetch_url", "calculate"],
  drafting: ["fetch_url", "web_search", "read_file"],
  automation: ["execute_bash", "schedule_task", "git_automation"]
};

// Define category-specific prompts
const CATEGORY_PROMPTS = {
  coding: "You are a senior software engineer helping with code tasks. Provide clear, concise technical guidance.",
  general: "You are a helpful assistant that can answer questions and provide information.",
  drafting: "You are a professional technical writer creating clear, well-structured documents.",
  automation: "You are a productivity automation specialist focused on optimizing workflows."
};

interface CategoryRoutingResult {
  activeCategory: string;
  availableTools: string[];
  systemPrompt: string;
}

export function useCategoryRouting(activeCategoryId: string): CategoryRoutingResult {
  return useMemo(() => {
    // Determine the category to use (default to coding)
    const category = activeCategoryId || "coding";
    
    // Get tools for this category
    const availableTools = CATEGORY_TOOLS[category] || CATEGORY_TOOLS.coding;
    
    // Get system prompt for this category
    const systemPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.general;
    
    return {
      activeCategory: category,
      availableTools,
      systemPrompt
    };
  }, [activeCategoryId]);
}