"use client";

import { useState, useEffect } from "react";
import { ThreadFeed } from "@kletron/ui/components/chat/ThreadFeed";
import { ChatInput } from "@kletron/ui/components/chat/ChatInput";
import { CategorySelector } from "../../../components/CategorySelector";
import { FileTree } from "../../../components/file-tree/FileTree";
import { useRouter } from "next/router";
import { WorkbenchLayout } from "../../../components/layout/WorkbenchLayout";

const builtInCategories = [
  {
    id: 'coding',
    name: 'Code Assistance',
    description: 'AI-powered code analysis, generation and debugging',
    color: '#3B82F6'
  },
  {
    id: 'drafting',
    name: 'Document Drafting',
    description: 'Create and edit professional documents',
    color: '#10B981'
  },
  {
    id: 'automation',
    name: 'Workflow Automation',
    description: 'Create automated workflows and follow-ups',
    color: '#F59E0B'
  }
];

const defaultCategories = [
  ...builtInCategories,
  {
    id: 'general',
    name: 'General Assistance',
    description: 'General purpose AI assistance',
    color: '#6B7280'
  }
];

export default function WorkbenchPage() {
  const router = useRouter();
  const [currentCategory, setCurrentCategory] = useState('coding');
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null);

  // Get workspace ID from URL
  const workspaceId = router.query.workspaceId as string;

  useEffect(() => {
    if (workspaceId) {
      fetch(`/api/workspaces/${workspaceId}`)
        .then(res => res.json())
        .then(data => setActiveWorkspace(data))
        .catch(err => console.error('Error fetching workspace:', err));
    }
  }, [workspaceId]);

  // Get category from URL or use default
  useEffect(() => {
    const urlCategory = router.query.category as string;
    if (urlCategory) {
      setCurrentCategory(urlCategory);
    } else if (activeWorkspace?.defaultCategoryId) {
      setCurrentCategory(activeWorkspace.defaultCategoryId);
    }
  }, [router.query.category, activeWorkspace]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content, timestamp: new Date() }]);
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const assistantMessage = {
        role: 'assistant',
        content: `I received your message about ${content.split(' ').slice(0, 3).join(' ')}. This is a simulated response for the ${currentCategory} category.`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const activeCategory = builtInCategories.find(c => c.id === currentCategory) || defaultCategories[0];

  return (
    <WorkbenchLayout>
      <div className="flex-1 overflow-hidden flex">
        {/* Category selector in sidebar */}
        <div className="w-64 border-r border-border bg-surface/50 p-4">
<CategorySelector
              currentCategory={currentCategory}
              workspaceId={workspaceId}
              onSelect={(categoryId) => {
                setCurrentCategory(categoryId);
                router.push(
                  `/app/${workspaceId}/workbench?category=${categoryId}`,
                  undefined,
                  { shallow: true }
                );
              }}
            />
        </div>

        {/* Category-specific content */}
        <div className="flex-1 flex flex-col">
          {currentCategory === 'coding' && (
            <>
              <div className="w-80 border-r border-border">
                <FileTree workspace={activeWorkspace?.name || "My Project"} />
              </div>
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-border font-medium text-foreground">Chat</div>
                <div className="flex-1 overflow-y-auto p-4">
                  <ThreadFeed messages={messages} isLoading={isLoading} />
                </div>
                <div className="border-t border-border p-4 bg-surface">
                  <ChatInput onSend={handleSendMessage} disabled={isLoading} />
                </div>
              </div>
            </>
          )}

          {currentCategory === 'drafting' && (
            <>
              <div className="p-4 border-b border-border font-medium text-foreground">Document Drafting</div>
              <ThreadFeed messages={messages} isLoading={isLoading} />
              <div className="mt-auto pt-4 border-t border-border bg-surface p-4">
                <ChatInput onSend={handleSendMessage} disabled={isLoading} placeholder="Describe what document you need to create..." />
              </div>
            </>
          )}

          {currentCategory === 'automation' && (
            <>
              <div className="p-4 border-b border-border font-medium text-foreground">Workflow Automation</div>
              <ThreadFeed messages={messages} isLoading={isLoading} />
              <div className="mt-auto pt-4 border-t border-border bg-surface p-4">
                <ChatInput onSend={handleSendMessage} disabled={isLoading} placeholder="Describe the workflow you want to automate..." />
              </div>
            </>
          )}

          {currentCategory === 'general' && (
            <>
              <div className="p-4 border-b border-border font-medium text-foreground">General Assistance</div>
              <ThreadFeed messages={messages} isLoading={isLoading} />
              <div className="mt-auto pt-4 border-t border-border bg-surface p-4">
                <ChatInput onSend={handleSendMessage} disabled={isLoading} placeholder="Ask anything..." />
              </div>
            </>
          )}
        </div>
      </div>
    </WorkbenchLayout>
  );
}

function FolderIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
