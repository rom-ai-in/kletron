/**
 * Simple skill loader for testing
 */

export function listSkills() {
  return [
    "research",
    "github_integration", 
    "terminal_access",
    "file_editing"
  ];
}

export async function loadSkill(skillId) {
  // Simple implementation for testing
  const skills = {
    research: { name: "Research", description: "Web search and research capabilities" },
    github_integration: { name: "GitHub Integration", description: "Access GitHub repositories" },
    terminal_access: { name: "Terminal Access", description: "Execute shell commands" },
    file_editing: { name: "File Editing", description: "Read and write files" }
  };
  
  return skills[skillId] || null;
}