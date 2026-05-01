"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@kletron/ui/components/design-system";
import { Button } from "@kletron/ui/components/ui/Button";
import {
  Code2,
  FileText,
  Zap,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";

const DEFAULT_CATEGORIES = [
  {
    id: "coding",
    name: "Code",
    description: "Write, debug, and review code with AI assistance",
    icon: Code2,
    tools: ["list_files", "read_file", "search_code", "execute_bash"],
  },
  {
    id: "drafting",
    name: "Draft",
    description: "Create documents, emails, and presentations",
    icon: FileText,
    tools: ["fetch_url", "web_search", "read_file"],
  },
  {
    id: "automation",
    name: "Automate",
    description: "Build workflows and daily follow-ups",
    icon: Zap,
    tools: ["execute_bash", "git_commit", "schedule_task"],
  },
  {
    id: "general",
    name: "Chat",
    description: "General assistance and open-ended questions",
    icon: MessageSquare,
    tools: [],
  },
];

export default function WorkCategoriesConfig() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const addCategory = () => {
    // TODO: Implement add category logic
    console.log("Add new category");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Work Categories</h1>
          <p className="text-text-muted mt-2">Configure different work modes and their available tools</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {categories.map((category) => (
          <Card key={category.id} className="border-border-subtle bg-bg-surface">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <category.icon className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>{category.name}</CardTitle>
                    <CardDescription>{category.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-text-muted mb-2">Available Tools</h4>
                  {category.tools.length > 0 ? (
                    <ul className="text-sm space-y-1">
                      {category.tools.map((tool) => (
                        <li key={tool} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-success" />
                          {tool}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-text-muted italic">No tools configured</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button onClick={addCategory} className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Add New Category
      </Button>
    </div>
  );
}
